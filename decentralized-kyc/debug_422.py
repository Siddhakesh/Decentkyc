
import httpx
import asyncio
import base64

async def test_upload():
    async with httpx.AsyncClient() as client:
        # Mocking a file upload
        files = {'file': ('test.txt', b'fake data', 'text/plain')}
        data = {'doc_type': 'passport'}
        headers = {'Authorization': 'Bearer MOCK_TOKEN'} # Change this if needed
        
        print("Testing /kyc/upload...")
        res = await client.post('http://127.0.0.1:8000/kyc/upload', files=files, data=data, headers=headers)
        print(f"Status: {res.status_code}")
        print(f"Detail: {res.text}")

async def test_liveness():
    async with httpx.AsyncClient() as client:
        print("\nTesting /kyc/liveness...")
        # Empty payload to trigger 422
        res = await client.post('http://127.0.0.1:8000/kyc/liveness', json={})
        print(f"Status: {res.status_code}")
        print(f"Detail: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_upload())
    asyncio.run(test_liveness())
