const axios = require('axios')
const API_KEY = '0NG0CBNGzTaej1Ph8NZSmcx9aZ4bOLqsNBLKjzmW';
class Location {
    async searchLocation(req, res, next) {
        const { query } = req.query;

        // Kiểm tra input
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Vui lòng nhập tối thiểu 2 ký tự để tìm kiếm.' });
        }

        try {
            // Gửi yêu cầu tới Goong API
            const response = await axios.get('https://rsapi.goong.io/Place/AutoComplete', {
                params: {
                    api_key: API_KEY,
                    input: query,
                  
                }
            });

            const data = response.data;

            if (data.status === 'OK') {
                const responseData = data.predictions.map(item => {
                    return {
                        description: item.description,
                        compound: item.compound
                    }
                })
                res.json(responseData);
            } else {
                res.status(400).json({ error: data.error_message || 'Không thể tìm kiếm địa chỉ.' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Đã xảy ra lỗi khi tìm kiếm địa chỉ.' });
        }
    }
}


module.exports = new Location()