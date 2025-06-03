# Flask application for translating natural language prompts to browser commands
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from routes.translate import translate_prompt
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'translator-api'
    })

# Main translation endpoint
@app.route('/translate', methods=['POST'])
def translate():
    try:
        # Get prompt from request
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({
                'error': 'Missing prompt in request body'
            }), 400
        
        prompt = data['prompt']
        logger.info(f"Received prompt: {prompt}")
        
        # Translate prompt to command
        command = translate_prompt(prompt, app.config['OPENAI_API_KEY'])
        
        if command:
            logger.info(f"Generated command: {command}")
            return jsonify(command)
        else:
            return jsonify({
                'error': 'Failed to translate prompt'
            }), 500
            
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error'
    }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)