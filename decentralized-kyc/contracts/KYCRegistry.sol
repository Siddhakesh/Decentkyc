// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KYCRegistry
 * @dev Decentralized KYC consent management contract.
 *
 * SECURITY DESIGN:
 * - Only SHA-256 hashes of IPFS CIDs are stored on-chain (never raw PII).
 * - Consent is captured as an on-chain event with a timestamp for audit purposes.
 * - Only the user (KYC owner) can grant or revoke access — not the bank.
 * - All state mutations emit events for off-chain audit log indexing.
 * - Validator role required before a KYC hash is marked "verified".
 */
contract KYCRegistry {

    // ─── Roles ───────────────────────────────────────────────────────────────
    address public owner;          // Contract deployer (platform admin)
    mapping(address => bool) public validators;   // KYC Validator Nodes

    // ─── KYC Record ──────────────────────────────────────────────────────────
    struct KYCRecord {
        bytes32 kycHash;       // SHA-256(IPFS CID of encrypted doc)
        string  ipfsCID;       // IPFS content ID (ciphertext only; not the doc)
        uint256 registeredAt;  // Block timestamp of registration
        uint256 expiresAt;     // Expiry timestamp for KYC validity
        bool    isVerified;    // Set true by a Validator node
    }

    // userAddress => KYCRecord
    mapping(address => KYCRecord) public kycRecords;

    // ─── Consent ─────────────────────────────────────────────────────────────
    // user => bank => consentStatus
    mapping(address => mapping(address => bool)) public consentGranted;

    // ─── Access Requests ─────────────────────────────────────────────────────
    // user => bank => requestPending
    mapping(address => mapping(address => bool)) public accessRequests;

    // ─── Events (used as immutable audit log) ────────────────────────────────
    event KYCRegistered(
        address indexed user,
        bytes32 kycHash,
        string  ipfsCID,
        uint256 expiresAt,
        uint256 timestamp
    );
    event KYCVerified(
        address indexed user,
        address indexed validator,
        uint256 timestamp
    );
    event AccessRequested(
        address indexed bank,
        address indexed user,
        uint256 timestamp
    );
    event ConsentGranted(
        address indexed user,
        address indexed bank,
        uint256 timestamp
    );
    event ConsentRevoked(
        address indexed user,
        address indexed bank,
        uint256 timestamp
    );
    event ValidatorAdded(address indexed validator, uint256 timestamp);
    event ValidatorRemoved(address indexed validator, uint256 timestamp);

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "KYCRegistry: caller is not owner");
        _;
    }

    modifier onlyValidator() {
        require(validators[msg.sender], "KYCRegistry: caller is not a validator");
        _;
    }

    modifier kycExists(address user) {
        require(kycRecords[user].registeredAt != 0, "KYCRegistry: no KYC record found");
        _;
    }

    modifier kycNotExpired(address user) {
        require(
            kycRecords[user].expiresAt == 0 || kycRecords[user].expiresAt > block.timestamp,
            "KYCRegistry: KYC record has expired"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        // The deployer is automatically a validator on launch
        validators[msg.sender] = true;
        emit ValidatorAdded(msg.sender, block.timestamp);
    }

    // ─── Validator Management ─────────────────────────────────────────────────
    /**
     * @dev Add a KYC validator node. Only callable by contract owner.
     * @param _validator Address of the validator node
     */
    function addValidator(address _validator) external onlyOwner {
        validators[_validator] = true;
        emit ValidatorAdded(_validator, block.timestamp);
    }

    function removeValidator(address _validator) external onlyOwner {
        validators[_validator] = false;
        emit ValidatorRemoved(_validator, block.timestamp);
    }

    // ─── KYC Registration ───────────────────────────────────────────────────
    /**
     * @dev Register a KYC hash for a user.
     *
     * SECURITY: Only the SHA-256 hash of the IPFS CID is stored.
     * The actual encrypted document lives off-chain on IPFS.
     * validityDays = 0 means no expiry (set sensible limit in backend).
     *
     * @param _kycHash   SHA-256 hash of the IPFS CID
     * @param _ipfsCID   IPFS CID of the AES-256 encrypted document
     * @param _validityDays  Number of days until KYC expires (0 = no expiry)
     */
    function registerKYCHash(
        bytes32 _kycHash,
        string calldata _ipfsCID,
        uint256 _validityDays
    ) external {
        uint256 expiresAt = _validityDays > 0
            ? block.timestamp + (_validityDays * 1 days)
            : 0;

        kycRecords[msg.sender] = KYCRecord({
            kycHash:      _kycHash,
            ipfsCID:      _ipfsCID,
            registeredAt: block.timestamp,
            expiresAt:    expiresAt,
            isVerified:   false
        });

        emit KYCRegistered(msg.sender, _kycHash, _ipfsCID, expiresAt, block.timestamp);
    }

    /**
     * @dev Validator marks a user's KYC as verified after off-chain document check.
     */
    function verifyKYC(address _user) external onlyValidator kycExists(_user) {
        kycRecords[_user].isVerified = true;
        emit KYCVerified(_user, msg.sender, block.timestamp);
    }

    // ─── Access Requests ────────────────────────────────────────────────────
    /**
     * @dev A bank (or any permitted entity) requests access to a user's KYC.
     *      The request is logged here; the user must grant consent separately.
     *
     * @param _user  Address of the user whose KYC is being requested
     */
    function requestAccess(address _user) external kycExists(_user) kycNotExpired(_user) {
        accessRequests[_user][msg.sender] = true;
        emit AccessRequested(msg.sender, _user, block.timestamp);
    }

    // ─── Consent Management ─────────────────────────────────────────────────
    /**
     * @dev User grants consent to a specific bank address.
     *      SECURITY: Only the user themselves can call this — enforced by msg.sender.
     *
     * @param _bank  Address of the bank to grant access to
     */
    function grantConsent(address _bank) external kycExists(msg.sender) kycNotExpired(msg.sender) {
        require(accessRequests[msg.sender][_bank], "KYCRegistry: no pending request from bank");
        consentGranted[msg.sender][_bank] = true;
        emit ConsentGranted(msg.sender, _bank, block.timestamp);
    }

    /**
     * @dev User revokes a previously granted consent.
     *      SECURITY: Zero-trust — revoke takes effect immediately, no grace period.
     *
     * @param _bank  Address of the bank to revoke access from
     */
    function revokeConsent(address _bank) external {
        consentGranted[msg.sender][_bank] = false;
        accessRequests[msg.sender][_bank] = false;
        emit ConsentRevoked(msg.sender, _bank, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────────────────
    /**
     * @dev Check if a bank has current valid consent to access a user's KYC.
     *      Banks call this before attempting to retrieve from IPFS.
     */
    function hasConsent(address _user, address _bank)
        external
        view
        returns (bool)
    {
        if (kycRecords[_user].expiresAt != 0 &&
            kycRecords[_user].expiresAt <= block.timestamp) {
            return false; // Expired KYC — consent automatically invalid
        }
        return consentGranted[_user][_bank];
    }

    /**
     * @dev Returns a user's KYC record (hash + CID). Banks use this CID
     *      to fetch the document from IPFS — only if consent is granted.
     */
    function getKYCRecord(address _user)
        external
        view
        kycExists(_user)
        returns (KYCRecord memory)
    {
        return kycRecords[_user];
    }

    /**
     * @dev Check if there is a pending access request from a bank for a user.
     */
    function hasPendingRequest(address _user, address _bank)
        external
        view
        returns (bool)
    {
        return accessRequests[_user][_bank];
    }

    /**
     * @dev Check if a user's KYC has expired.
     */
    function isKYCExpired(address _user) external view returns (bool) {
        KYCRecord memory rec = kycRecords[_user];
        if (rec.registeredAt == 0) return true;         // No record
        if (rec.expiresAt == 0) return false;           // No expiry set
        return block.timestamp > rec.expiresAt;
    }
}
