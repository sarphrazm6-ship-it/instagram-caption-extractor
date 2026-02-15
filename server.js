const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function extractShortcode(url) {
    const match = url.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
}

// Improved Instagram scraping with better headers
async function getInstagramCaption(url) {
    try {
        const shortcode = extractShortcode(url);
        if (!shortcode) {
            return { success: false, error: 'Invalid URL format' };
        }

        // Method 1: Try embed endpoint
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
        
        const response = await axios.get(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.instagram.com/',
                'Connection': 'keep-alive',
            },
            timeout: 10000
        });

        const html = response.data;
        
        // Extract caption from HTML
        let caption = null;
        
        // Try multiple patterns
        const patterns = [
            /<meta property="og:description" content="([^"]*)">/,
            /<div class="Caption">([^<]*)<\/div>/,
            /"caption":"([^"]*)">/,
            /window\._sharedData = ({.+});<\/script>/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                caption = match[1];
                // Decode HTML entities
                caption = caption
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&#039;/g, "'")
                    .replace(/\\n/g, '\n')
                    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => 
                        String.fromCharCode(parseInt(hex, 16))
                    );
                break;
            }
        }

        if (caption && caption.trim()) {
            return {
                success: true,
                caption: caption.trim()
            };
        }

        // Fallback: Return a helpful message
        return {
            success: false,
            error: 'Could not extract caption. The reel might be private or Instagram is blocking automated requests. Try a different public reel from a verified account.'
        };

    } catch (error) {
        console.error('Error:', error.message);
        return {
            success: false,
            error: 'Failed to fetch caption. Please try again with a public reel from a popular account.'
        };
    }
}

app.post('/api/extract-caption', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        const instagramPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|reels|p)\/[\w-]+/i;
        if (!instagramPattern.test(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Instagram URL'
            });
        }

        const result = await getInstagramCaption(url);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error. Please try again.'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
