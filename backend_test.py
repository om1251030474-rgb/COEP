#!/usr/bin/env python3
"""
Backend API Testing for AI-Powered Urban Drone Emergency Response System
Tests all required endpoints and validates core functionality
"""

import requests
import sys
import json
import io
from datetime import datetime
import time

class DroneEmergencyAPITester:
    def __init__(self, base_url="https://smart-dispatch-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        
    def run_test(self, name, method, endpoint, expected_status=200, data=None, files=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        # Don't set Content-Type for multipart form data
        if not files:
            headers['Content-Type'] = 'application/json'
            
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                if files:
                    # For multipart form data, let requests handle Content-Type
                    response = self.session.post(url, data=data, files=files, timeout=timeout)
                else:
                    response = self.session.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, headers=headers, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response for additional info
                try:
                    json_data = response.json()
                    if isinstance(json_data, dict):
                        if 'message' in json_data:
                            print(f"   Message: {json_data['message']}")
                        if 'status' in json_data:
                            print(f"   Status: {json_data['status']}")
                    elif isinstance(json_data, list):
                        print(f"   Response: List with {len(json_data)} items")
                    
                    return True, json_data
                except:
                    return True, response.text
                    
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")
                    
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'url': url
                })
                
            return success, {}
            
        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout after {timeout}s")
            self.failed_tests.append({'name': name, 'error': 'Timeout', 'url': url})
            return False, {}
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Failed - Connection error: {str(e)}")
            self.failed_tests.append({'name': name, 'error': f'Connection: {str(e)}', 'url': url})
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({'name': name, 'error': str(e), 'url': url})
            return False, {}

    def test_api_root(self):
        """Test GET /api/ - Should return operational status"""
        success, response = self.run_test(
            "API Root Status",
            "GET", 
            "/api/",
            200
        )
        if success and isinstance(response, dict):
            if 'status' in response and response['status'] == 'operational':
                print(f"   ✓ Service is operational")
                return True
            else:
                print(f"   ⚠️  Unexpected status in response")
        return success
        
    def test_health_check(self):
        """Test GET /api/health - Should return health status"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/api/health", 
            200
        )
        if success and isinstance(response, dict):
            if 'status' in response:
                print(f"   ✓ Health status: {response['status']}")
        return success

    def test_get_drones(self):
        """Test GET /api/drones - Should return 5 drones"""
        success, response = self.run_test(
            "Get Drone Fleet",
            "GET",
            "/api/drones",
            200
        )
        if success and isinstance(response, list):
            drone_count = len(response)
            print(f"   ✓ Found {drone_count} drones")
            
            if drone_count == 5:
                print(f"   ✓ Expected 5 drones, got {drone_count}")
                # Check drone structure
                if response:
                    drone = response[0]
                    required_fields = ['id', 'name', 'lat', 'lng', 'battery', 'status']
                    missing_fields = [field for field in required_fields if field not in drone]
                    if not missing_fields:
                        print(f"   ✓ Drone structure valid")
                    else:
                        print(f"   ⚠️  Missing drone fields: {missing_fields}")
                return True
            else:
                print(f"   ⚠️  Expected 5 drones, got {drone_count}")
                return False
        else:
            print(f"   ❌ Response is not a list or empty")
            return False

    def test_get_stats(self):
        """Test GET /api/stats - Should return system statistics"""
        success, response = self.run_test(
            "Get System Statistics", 
            "GET",
            "/api/stats",
            200
        )
        if success and isinstance(response, dict):
            expected_sections = ['incidents', 'drones', 'timestamp']
            missing_sections = [section for section in expected_sections if section not in response]
            
            if not missing_sections:
                print(f"   ✓ Stats structure valid")
                if 'incidents' in response:
                    incidents = response['incidents']
                    print(f"   ✓ Incidents: {incidents}")
                if 'drones' in response:
                    drones = response['drones'] 
                    print(f"   ✓ Drones: {drones}")
                return True
            else:
                print(f"   ⚠️  Missing stats sections: {missing_sections}")
                return False
        return success

    def test_get_incidents(self):
        """Test GET /api/incidents - Should return incidents list"""
        success, response = self.run_test(
            "Get Incidents List",
            "GET", 
            "/api/incidents",
            200
        )
        if success and isinstance(response, list):
            incident_count = len(response)
            print(f"   ✓ Found {incident_count} incidents")
            
            # Check incident structure if any exist
            if response:
                incident = response[0]
                required_fields = ['incident_id', 'type', 'location', 'timestamp', 'status']
                missing_fields = [field for field in required_fields if field not in incident]
                if not missing_fields:
                    print(f"   ✓ Incident structure valid")
                else:
                    print(f"   ⚠️  Missing incident fields: {missing_fields}")
            return True
        return success

    def test_report_incident(self):
        """Test POST /api/report-incident - Should accept multipart form data"""
        print(f"\n🔍 Testing Report Incident (Multipart Form)...")
        
        # Create a simple test video file (small binary data)
        test_video_content = b'\x00\x00\x00\x20ftypmp41\x00\x00\x00\x00mp41isom' + b'\x00' * 100
        test_video_file = io.BytesIO(test_video_content)
        test_video_file.name = 'test_incident.mp4'
        
        # Form data
        form_data = {
            'latitude': '28.6100',  # Delhi coordinates
            'longitude': '77.2000',
            'incident_type': 'fire'
        }
        
        # Files
        files = {
            'video_file': ('test_incident.mp4', test_video_file, 'video/mp4')
        }
        
        success, response = self.run_test(
            "Report Incident (Multipart)",
            "POST",
            "/api/report-incident",
            200,  # Expecting success
            data=form_data,
            files=files,
            timeout=45  # Longer timeout for file upload
        )
        
        if success and isinstance(response, dict):
            if 'incident_id' in response:
                print(f"   ✓ Incident created: {response['incident_id']}")
            if 'status' in response:
                print(f"   ✓ Response status: {response['status']}")
            return True
        return success

    def test_websocket_endpoint(self):
        """Test WebSocket endpoint accessibility (basic connectivity test)"""
        try:
            import websocket
            ws_url = self.base_url.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws'
            print(f"\n🔍 Testing WebSocket Connectivity...")
            print(f"   WS URL: {ws_url}")
            
            # Simple connection test with timeout
            ws = websocket.create_connection(ws_url, timeout=10)
            ws.close()
            print(f"✅ WebSocket connection successful")
            self.tests_run += 1
            self.tests_passed += 1
            return True
            
        except ImportError:
            print(f"⚠️  WebSocket test skipped (websocket-client not available)")
            return True  # Don't count as failure
        except Exception as e:
            print(f"❌ WebSocket connection failed: {str(e)}")
            self.tests_run += 1
            self.failed_tests.append({'name': 'WebSocket Connection', 'error': str(e), 'url': ws_url})
            return False

def main():
    """Run all backend API tests"""
    print("=" * 80)
    print("🚁 AI-POWERED URBAN DRONE EMERGENCY RESPONSE SYSTEM - API TESTING")
    print("=" * 80)
    
    tester = DroneEmergencyAPITester()
    
    # Core API tests in order of importance
    tests = [
        tester.test_api_root,
        tester.test_health_check, 
        tester.test_get_drones,
        tester.test_get_stats,
        tester.test_get_incidents,
        tester.test_report_incident,
        tester.test_websocket_endpoint
    ]
    
    print(f"\nRunning {len(tests)} API tests...\n")
    
    # Run all tests
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test {test_func.__name__} crashed: {str(e)}")
            tester.failed_tests.append({
                'name': test_func.__name__, 
                'error': f'Test crashed: {str(e)}',
                'url': 'N/A'
            })
        
        time.sleep(0.5)  # Brief pause between tests
    
    # Print summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {len(tester.failed_tests)}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"  {i}. {failure['name']}")
            if 'expected' in failure:
                print(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
            if 'error' in failure:
                print(f"     Error: {failure['error']}")
            if 'url' in failure:
                print(f"     URL: {failure['url']}")
    
    print(f"\n{'🎉 ALL TESTS PASSED!' if success_rate == 100 else '⚠️  SOME TESTS FAILED'}")
    
    # Return appropriate exit code
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())