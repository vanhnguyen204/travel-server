const { pool } = require('../../db/index.js');

class TravelPlanController {
    async validateEditTravelPlan(req, res, next) {
        try {
            const { name, startDate, endDate, groupId } = req.body;

            // Kiểm tra ngày bắt đầu và ngày kết thúc
            if (new Date(startDate) > new Date(endDate)) {
                return res.status(400).json({
                    message: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
                });
            }

            // Lấy danh sách các kế hoạch du lịch trong cùng groupId
            const [travels] = await pool
                .promise()
                .query('SELECT * FROM travel_plan WHERE group_id = ?', [groupId]);

            // Kiểm tra trùng thời gian
            for (const travel of travels) {
                const existingStartDate = new Date(travel.start_date);
                const existingEndDate = new Date(travel.end_date);

                // Kế hoạch mới không được trùng thời gian với các kế hoạch hiện tại
                if (
                    (new Date(startDate) <= existingEndDate && new Date(startDate) >= existingStartDate) || // Trùng trong khoảng ngày bắt đầu
                    (new Date(endDate) >= existingStartDate && new Date(endDate) <= existingEndDate) || // Trùng trong khoảng ngày kết thúc
                    (new Date(startDate) <= existingStartDate && new Date(endDate) >= existingEndDate) // Bao phủ toàn bộ
                ) {
                    return res.status(400).json({
                        message: `Kế hoạch mới bị trùng thời gian với kế hoạch "${travel.plan_name}" (từ ${travel.start_date} đến ${travel.end_date}).`,
                    });
                }
            }

            res.status(200).json({
                message: 'Kế hoạch hợp lệ.',
            });
        } catch (error) {
            console.error('Error validating travel plan:', error);
            res.status(500).json({
                message: 'Error validate travel plan: ' + error,
            });
            next();
        }
    }
}

module.exports = new TravelPlanController();
