"""
app/services/liveness.py
────────────────────────
CV-based liveness verification using OpenCV.
Checks for face presence and features in a captured image.
"""

import cv2
import numpy as np
import base64

def verify_liveness(image_b64: str) -> (bool, int):
    """
    Decodes a base64 image and runs face detection.
    Returns: (is_valid, score)
    """
    try:
        # 1. Decode base64
        if "base64," in image_b64:
            image_b64 = image_b64.split("base64,")[1]
            
        header, encoded = image_b64.split(",", 1) if "," in image_b64 else (None, image_b64)
        img_data = base64.b64decode(encoded)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return False, 0

        # 2. Convert to grayscale for detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 3. Load Haar Cascade for face detection
        # Using the standard opencv data path
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        if len(faces) == 0:
            return False, 0

        # Basic scoring based on face size and presence of eyes
        # (This is a simplified POC for "Liveness")
        score = 50 # Base score for finding a face
        
        for (x, y, w, h) in faces:
            roi_gray = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray)
            
            # If we find 2 eyes, it's a higher quality match
            if len(eyes) >= 2:
                score += 40
            elif len(eyes) == 1:
                score += 20
                
            # Check face size relative to image
            face_area = w * h
            img_area = img.shape[0] * img.shape[1]
            if 0.1 < (face_area / img_area) < 0.6:
                score += 10 # Good distance from camera

        return score >= 60, min(score, 100)

    except Exception as e:
        print(f"[Liveness] CV Error: {e}")
        return False, 0

def compare_faces(live_image_b64: str, id_image_bytes: bytes) -> (bool, int):
    """
    Compares a live selfie (base64) with a face in the ID document (bytes).
    Uses ORB feature matching and descriptor distance.
    Returns: (is_match, match_score)
    """
    try:
        # 1. Decode Live Image
        if "base64," in live_image_b64:
            live_image_b64 = live_image_b64.split("base64,")[1]
        live_img_data = base64.b64decode(live_image_b64)
        nparr1 = np.frombuffer(live_img_data, np.uint8)
        live_img = cv2.imdecode(nparr1, cv2.IMREAD_COLOR)

        # 2. Decode ID Image
        nparr2 = np.frombuffer(id_image_bytes, np.uint8)
        id_img = cv2.imdecode(nparr2, cv2.IMREAD_COLOR)

        if live_img is None or id_img is None:
            return False, 0

        # 3. Detect faces in both
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        def get_face_roi(img):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) == 0: return None
            # Get largest face
            (x, y, w, h) = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
            return gray[y:y+h, x:x+w]

        live_face = get_face_roi(live_img)
        id_face = get_face_roi(id_img)

        if live_face is None or id_face is None:
            return False, 0

        # 4. Feature Matching (ORB)
        orb = cv2.ORB_create(nfeatures=500)
        kp1, des1 = orb.detectAndCompute(live_face, None)
        kp2, des2 = orb.detectAndCompute(id_face, None)

        if des1 is None or des2 is None:
            return False, 10 # Some base score for finding faces but no features

        # Match descriptors
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        
        # Sort by distance
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Calculate score based on number of good matches
        # and average distance
        good_matches = [m for m in matches if m.distance < 50]
        
        match_count = len(good_matches)
        if match_count == 0: return False, 0
        
        avg_dist = sum(m.distance for m in good_matches) / match_count
        
        # Scoring heuristic: 
        # Higher match count + lower distance = higher score
        score = min(100, int((match_count / 30) * 100))
        # Penalty for high average distance
        score = max(0, score - int(avg_dist / 2))

        return score > 40, score

    except Exception as e:
        print(f"[Face Match] Error: {e}")
        return False, 0
