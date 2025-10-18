"""
Business: VneChat authentication - registration, login, profile management
Args: event with httpMethod, body (username, email, password, first_name, last_name)
Returns: HTTP response with JWT token and user profile or error
"""
import json
import os
import psycopg2
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Dict, Any

JWT_SECRET = os.environ.get('JWT_SECRET', 'vnechat-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7

def get_db_connection():
    """Create database connection using simple query protocol"""
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def generate_token(user_id: int, username: str) -> str:
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle authentication requests"""
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    action = body_data.get('action')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # REGISTRATION
        if action == 'register':
            username = body_data.get('username', '').strip()
            email = body_data.get('email', '').strip().lower()
            password = body_data.get('password', '')
            first_name = body_data.get('first_name', '').strip()
            last_name = body_data.get('last_name', '').strip()
            
            if not username or not email or not password or not first_name or not last_name:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'All fields are required'})
                }
            
            if len(password) < 8:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Password must be at least 8 characters'})
                }
            
            # Check if user exists
            cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
            if cur.fetchone():
                return {
                    'statusCode': 409,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User already exists'})
                }
            
            # Create user
            password_hash = hash_password(password)
            cur.execute(
                """INSERT INTO users (username, email, password_hash, first_name, last_name, online) 
                   VALUES (%s, %s, %s, %s, %s, true) 
                   RETURNING id, username, first_name, last_name, email, avatar_url, status""",
                (username, email, password_hash, first_name, last_name)
            )
            user = cur.fetchone()
            conn.commit()
            
            token = generate_token(user[0], user[1])
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'token': token,
                    'user': {
                        'id': user[0],
                        'username': user[1],
                        'first_name': user[2],
                        'last_name': user[3],
                        'email': user[4],
                        'avatar_url': user[5],
                        'status': user[6]
                    }
                })
            }
        
        # LOGIN
        elif action == 'login':
            username_or_email = body_data.get('username', '').strip().lower()
            password = body_data.get('password', '')
            
            if not username_or_email or not password:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Username/email and password are required'})
                }
            
            # Find user
            cur.execute(
                """SELECT id, username, password_hash, first_name, last_name, email, avatar_url, status 
                   FROM users WHERE LOWER(username) = %s OR LOWER(email) = %s""",
                (username_or_email, username_or_email)
            )
            user = cur.fetchone()
            
            if not user or not verify_password(password, user[2]):
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid credentials'})
                }
            
            # Update user online status
            cur.execute("UPDATE users SET online = true, last_seen = CURRENT_TIMESTAMP WHERE id = %s", (user[0],))
            conn.commit()
            
            token = generate_token(user[0], user[1])
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'token': token,
                    'user': {
                        'id': user[0],
                        'username': user[1],
                        'first_name': user[3],
                        'last_name': user[4],
                        'email': user[5],
                        'avatar_url': user[6],
                        'status': user[7]
                    }
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action. Use "register" or "login"'})
            }
    
    finally:
        cur.close()
        conn.close()
