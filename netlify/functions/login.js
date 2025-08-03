// netlify/functions/login.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { username, password } = JSON.parse(event.body);

    // These variables will be pulled from your Netlify site settings
    const storedUsername = process.env.MY_USERNAME;
    const storedPasswordHash = process.env.MY_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    // Check if the username is correct and the submitted password matches the stored hash
    const isUsernameCorrect = (username === storedUsername);
    const isPasswordCorrect = await bcrypt.compare(password, storedPasswordHash);

    if (isUsernameCorrect && isPasswordCorrect) {
        // If credentials are correct, create a secure token (JWT)
        const token = jwt.sign({ user: storedUsername }, jwtSecret, { expiresIn: '1d' });

        // Return a success response and set the token in a secure, httpOnly cookie.
        // This cookie can't be accessed by JavaScript in the browser, which is crucial for security.
        return {
            statusCode: 200,
            headers: {
                'Set-Cookie': `batcloud_token=${token}; HttpOnly; Path=/; Secure; SameSite=Strict; Max-Age=86400`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ success: true })
        };
    } else {
        // If credentials are wrong, return an error
        return {
            statusCode: 401,
            body: JSON.stringify({ success: false, message: 'Invalid credentials' })
        };
    }
};
