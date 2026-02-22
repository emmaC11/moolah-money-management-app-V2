// controllers/currency.controller.js

exports.getExchangeRates = async (req, res) => {
    try {
        const url = 'https://api.frankfurter.dev/v1/latest';

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Frankfurter API error: ${response.status}`);
        }

        const data = await response.json();

        res.status(200).json({
            success: true,
            base: data.base,
            date: data.date,
            rates: data.rates
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: "Currency service unavailable",
            message: error.message 
        });
    }
};