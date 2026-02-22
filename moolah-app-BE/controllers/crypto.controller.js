exports.getTopCrypto = async (req, res) => {
    try {
        const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false';

        console.log("Fetching from CoinGecko...");

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MoolahApp/1.0'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("CoinGecko Error:", response.status, errorBody);
            return res.status(response.status).json({
                success: false,
                error: "CoinGecko API Error",
                message: `API returned status ${response.status}`
            });
        }

        const data = await response.json();

        res.status(200).json({
            success: true,
            data: data.map(coin => ({
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: coin.current_price,
                market_cap: coin.market_cap,
                image: coin.image
            }))
        });

    } catch (error) {
        console.error("SERVER ERROR:", error.message);
        res.status(500).json({
            success: false,
            error: "Network error",
            details: error.message
        });
    }
};