// controllers/crypto.controller.js
const BASE_URL = 'https://api.freecryptoapi.com/v1/getTop';

exports.getTopCrypto = async (req, res) =>{
        const apiKey = process.env.CRYPTO_API_KEY;

        try {const apiResponse = await fetch(`${BASE_URL}?top=10`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: "External API failed" });
        }

        const data = await apiResponse.json();

        
        res.status(200).json(data);}
     catch (error) {
        console.error("Caught error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Server crashed" });
        }
    }};


