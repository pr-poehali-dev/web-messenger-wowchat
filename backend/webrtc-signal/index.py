"""
Business: WebRTC signaling server for P2P video/audio calls
Args: event with httpMethod, body (signal type, from, to, offer, answer, ice candidate)
Returns: HTTP response with success status
"""
import json
import time
from typing import Dict, Any

# In-memory storage for signals (in production use Redis)
signal_storage: Dict[str, Any] = {}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle WebRTC signaling"""
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # SEND SIGNAL
    if method == 'POST':
        try:
            body_data = json.loads(event.get('body', '{}'))
            signal_type = body_data.get('type')
            from_user = body_data.get('from')
            to_user = body_data.get('to')
            
            if not signal_type or not from_user or not to_user:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Missing required fields'})
                }
            
            # Store signal for recipient
            signal_key = f"signal_{to_user}_{int(time.time() * 1000)}"
            signal_storage[signal_key] = {
                'type': signal_type,
                'from': from_user,
                'to': to_user,
                'offer': body_data.get('offer'),
                'answer': body_data.get('answer'),
                'candidate': body_data.get('candidate'),
                'callType': body_data.get('callType'),
                'timestamp': time.time()
            }
            
            # Clean up old signals (older than 5 minutes)
            current_time = time.time()
            keys_to_delete = [
                key for key, value in signal_storage.items()
                if current_time - value.get('timestamp', 0) > 300
            ]
            for key in keys_to_delete:
                del signal_storage[key]
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'message': 'Signal sent',
                    'signalKey': signal_key
                })
            }
        except Exception as e:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Invalid signal data: {str(e)}'})
            }
    
    # GET SIGNALS
    elif method == 'GET':
        query_params = event.get('queryStringParameters') or {}
        user_id = query_params.get('user_id')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'user_id required'})
            }
        
        # Get all signals for this user
        user_signals = [
            {
                'key': key,
                'type': value['type'],
                'from': value['from'],
                'offer': value.get('offer'),
                'answer': value.get('answer'),
                'candidate': value.get('candidate'),
                'callType': value.get('callType')
            }
            for key, value in signal_storage.items()
            if value['to'] == user_id
        ]
        
        # Delete retrieved signals
        for signal in user_signals:
            if signal['key'] in signal_storage:
                del signal_storage[signal['key']]
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'signals': user_signals})
        }
    
    else:
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
