const { pool } = require("../../db");
const {
  getUsers,
  getUsersAsYouKnown,
  getFriendInvite,
  getMyFriend,
} = require("../models/Friend.model");
const javaDeserialize = require("java-deserialization");
const SocketManager = require("../../socket/index.js");
const {
  sendPushNotification,
} = require("../../firebase/notification-firebase.js");
const { updateTopicEnable } = require("../../socket/friend.io.js");
class FriendController {
  async handleDeleteFriend(req, res, next) {
    try {
      const { id: yourId } = req.body.userInfo;
      const { friendId } = req.query;
      await pool
        .promise()
        .query(
          "UPDATE  friend_ship set status = 'DELETE' where (user_received_id = ? AND user_send_id = ?) or (user_received_id = ? AND user_send_id = ?)",
          [yourId, friendId, friendId, yourId]
        );
      return res.status(200).json({
        message: "Từ chối lời mời kết bạn thành công.",
        status: true,
      });
    } catch (error) {
      console.error("Error handleDeleteFriend :", error);
      res.status(500).json({
        message: "Error handleDeleteFriend : " + error.message,
        status: false,
      });
      next(error);
    }
  }
  async handleCancelMakeFriend(req, res, next) {
    try {
      const { id: yourId } = req.body.userInfo;
      const { friendId } = req.query;
      await pool
        .promise()
        .query(
          "UPDATE  friend_ship set status = 'CANCEL' where user_received_id = ? AND user_send_id = ?",
          [friendId, yourId]
        );
      return res.status(200).json({
        message: "Huỷ yêu cầu kết bạn thành công.",
        status: true,
      });
    } catch (error) {
      console.error("Error handleCancelMakeFriend:", error);
      res.status(500).json({
        message: "Error handleCancelMakeFriend: " + error.message,
        status: false,
      });
      next(error);
    }
  }
  async handleRejectFriend(req, res, next) {
    try {
      const { id: yourId } = req.body.userInfo;
      const { friendId } = req.query;
      await pool
        .promise()
        .query(
          "UPDATE  friend_ship set status = 'REJECT' where (user_received_id = ? AND user_send_id = ?) or (user_received_id = ? AND user_send_id = ?)",
          [yourId, friendId, friendId, yourId]
        );
      return res.status(200).json({
        message: "Từ chối lời mời kết bạn thành công.",
        status: true,
      });
    } catch (error) {
      console.error("Error handleRejectFriend :", error);
      res.status(500).json({
        message: "Error handleRejectFriend : " + error.message,
        status: false,
      });
      next(error);
    }
  }
  async handleAcceptFriend(req, res, next) {
    try {
      const { id: yourId } = req.body.userInfo;
      const { friendId } = req.query;
      const query = `
update friend_ship set status = 'ACCEPT' where user_received_id = ? AND user_send_id = ?
`;
      console.log("QUery: ", yourId, " friend: ", friendId);

      await pool.promise().query(query, [yourId, friendId]);

    

      return res.status(200).json({
        message: "Chấp nhận lời mời kết bạn thành công.",
        status: true,
      });
    } catch (error) {
      console.error("Error request make friend :", error);
      res.status(500).json({
        message: "Error request make friend : " + error.message,
        status: false,
      });
      next(error);
    }
  }
  async handleRequestMakeFriend(req, res, next) {
    try {
      const io = SocketManager.getIO();

      const foregroundNotifyNameSpace = io.of("/notifications/foreground");
      const {
        id: userId,
        fullname: yourName,
        avatar_url: yourAvatar,
      } = req.body.userInfo;
      const { friendId } = req.body;
      if (!friendId) {
        return res.status(400).json({
          message: "Vui lòng nhập friendId để sử dụng API này",
          status: false,
        });
      }
      const [friendInfo] = await pool
        .promise()
        .query("SELECT * from user where id = ? AND delflag = 0 ", [friendId]);

      if (friendInfo.length === 0) {
        return res.status(400).json({
          message: "Tài khoản này không tồn tại hoặc đã bị khoá.",
          status: false,
        });
      }
      const { fullname, avatar_url, device_token, current_device } =
        friendInfo[0];
      const [checkIsAlreadyRequest] = await pool
        .promise()
        .query(
          "select * from friend_ship where (user_received_id = ? AND user_send_id = ?) or (user_received_id = ? AND user_send_id = ?)",
          [friendId, userId, userId, friendId]
        );
      if (checkIsAlreadyRequest.length === 0) {
        // return res.status(400).json({
        //   message:
        //     "Bạn đã gửi lời lời kết bạn cho " +
        //     fullname +
        //     " rồi, vui lòng không spam",
        //   status: false,
        // });
        await pool.promise().query(
          `
                    INSERT INTO friend_ship ( create_time, status, user_received_id, user_send_id )
                    VALUES (NOW(), 'PENDING', ?, ?)`,
          [friendId, userId]
        );
      } else {
        const { status } = checkIsAlreadyRequest[0];
        if (status !== "PENDING") {
          const query = `
            update friend_ship set status = 'PENDING',user_received_id = ?, user_send_id = ?  where (user_received_id = ? AND user_send_id = ?) or (user_received_id = ? AND user_send_id = ?)
            `;
          await pool
            .promise()
            .query(query, [
              friendId,
              userId,
              friendId,
              userId,
              userId,
              friendId,
            ]);
        }
      }

      const { fetchImageAsBase64 } = await import("../../utils/file.mjs");
      const imageBase64 = yourAvatar
        ? await fetchImageAsBase64(yourAvatar)
        : "";
      //   const rooms = foregroundNotifyNameSpace.adapter.rooms;
      //   console.log("Rooms: ", rooms);
      //   console.log("FriendId: ", friendId);
      const message = yourName + " đã gửi cho bạn lời mời kết bạn.";
      const title = "Thông báo kết bạn";
      foregroundNotifyNameSpace
        .to(+friendId)
        .emit("friend-request-make-friend", {
          title: title,
          message: message,
          type: "friend",
          imageBase64: imageBase64,
        });

      if (device_token) {
        await sendPushNotification(device_token, message, title, {
          type: "REQUEST_MAKE_FRIEND",
        });
      }
      return res.status(200).json({
        message: "OKE",
      });
    } catch (error) {
      console.error("Error request make friend :", error);
      res.status(500).json({
        message: "Error request make friend : " + error.message,
        status: false,
      });
      next(error);
    }
  }

  async searchUser(req, res, next) {
    try {
      const { fullname } = req.query;
      const { id: userId } = req.body.userInfo;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;

      if (page < 1 || limit < 1) {
        return res.status(400).json({
          status: false,
          message: "Page và limit phải lớn hơn 1",
        });
      }

      if (!fullname) {
        return res.status(400).json({
          message: "Fullname is required for search.",
          status: false,
        });
      }

      // Tính toán offset cho phân trang
      const offset = (page - 1) * limit;

      // Câu truy vấn SQL để tìm kiếm người dùng theo fullname
      const query = `
      SELECT 
          u.id AS user_id, 
          u.fullname, 
          u.avatar_url, 
          u.roles, 
          CASE
              WHEN fs.status IS NULL THEN NULL
              ELSE fs.status
          END AS friend_status,
          CASE
              WHEN fs.status = 'pending' THEN 
                  CASE 
                      WHEN fs.user_send_id = ? THEN true
                      ELSE false
                  END
              ELSE NULL
          END AS isSender
      FROM user u
      LEFT JOIN friend_ship fs
          ON (fs.user_send_id = u.id AND fs.user_received_id = ?)
          OR (fs.user_send_id = ? AND fs.user_received_id = u.id)
      WHERE u.fullname LIKE ?
        AND u.id != ?
        AND delflag = 0;
  `;

      // Lấy toàn bộ danh sách user (không giới hạn phân trang để xử lý role)
      const [allUsers] = await pool
        .promise()
        .query(query, [userId, userId, userId, `%${fullname}%`, userId]);

      // Lọc user có role là USER
      const filteredUsers = allUsers
        .filter((user) => {
          const rolesBuffer = user.roles; // Dữ liệu BLOB trả về từ MySQL
          let rolesObject;

          if (Buffer.isBuffer(rolesBuffer)) {
            try {
              rolesObject = javaDeserialize.parse(rolesBuffer);
            } catch (error) {
              console.error("Error deserializing roles:", error);
            }
          }
          return rolesObject[0]?.list.some((it) => it === "USER");
        })
        .map((item) => {
          const { roles, ...rest } = item;
          return {
            ...rest,
            isSender: rest.isSender === 1 ? true : false,
          };
        });

      // Tính tổng số phần tử sau khi lọc
      const totalElements = filteredUsers.length;

      // Cắt danh sách theo phân trang
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      // Trả về kết quả
      return res.status(200).json({
        message: "Tìm kiếm thành công",
        data: {
          content: paginatedUsers,
          pageNumber: page,
          pageSize: limit,
          totalElements,
          totalPages: Math.ceil(totalElements / limit),
          first: page === 1,
          last: offset + paginatedUsers.length >= totalElements,
          empty: paginatedUsers.length === 0,
        },
        status: true,
      });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({
        message: "Error searching users: " + error.message,
        status: false,
      });
      next(error);
    }
  }

  async getUsersFromDB(req, res, next) {
    try {
      const { userId } = req.query;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;
      if (page < 1 || limit < 1) {
        return res.status(400).json({
          status: false,
          message: "Page và limit phải lớn hơn 1",
        });
      }
      if (!userId) {
        return res.status(400).json({
          status: false,
          message: "Yêu cầu userId ở params để sử dụng api này",
        });
      }
      const users = await getUsers({
        currentUserId: userId,
        page,
        pageSize: limit,
      });
      return res.status(200).json({
        message: "Lấy danh sách người dùng thành công",
        data: users,
        status: false,
      });
    } catch (error) {
      console.error("Error getting users from db:", error);
      res.status(500).json({
        message: "Error getting users from db: " + error.message,
        status: false,
      });
      next(error);
    }
  }
  async getUsersNearYou(req, res, next) {
    try {
      const { id: userId } = req.body.userInfo;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;

      const { latitude, longitude } = req.body.userInfo;

      // Tính toán offset và limit cho phân trang
      const offset = (page - 1) * limit; // Vị trí bắt đầu

      // Lấy danh sách người dùng gần bạn
      const querySpace = haversineQuery(
        latitude,
        longitude,
        limit,
        offset,
        userId
      );
      // console.log('Query: ', querySpace);

      // Lấy dữ liệu người dùng gần bạn
      const [friends] = await pool.promise().query(querySpace);

      // Tính tổng số người dùng gần bạn
      const totalQuery = `
       SELECT COUNT(*) AS totalElements
    FROM (
        SELECT id,
               (6371 * acos(
                   cos(radians(${latitude})) * cos(radians(latitude)) 
                   * cos(radians(longitude) - radians(${longitude})) 
                   + sin(radians(${latitude})) * sin(radians(latitude))
               )) AS distance
        FROM user
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND id != ?
    ) AS calculated_distance
    INNER JOIN user u ON calculated_distance.id = u.id
    WHERE u.longitude IS NOT NULL 
      AND u.latitude IS NOT NULL 
      AND u.is_locked = 'OPEN'
      AND calculated_distance.distance < 10;
        `;

      const [totalResult] = await pool.promise().query(totalQuery, [userId]);
      const totalElements = totalResult[0].totalElements;
      const totalPages = Math.ceil(totalElements / limit); // Tính tổng số trang

      // Trả về kết quả phân trang
      res.json({
        message: "Get friends nearby successfully!",
        data: {
          pageNumber: page,
          pageSize: limit,
          last: offset + friends.length >= totalElements, // Nếu số lượng bài viết ít hơn limit thì đây là trang cuối
          totalPages: totalPages,
          totalElements: totalElements,
          first: page === 1,
          size: limit,
          empty: friends.length === 0,
          content: friends.map((item) => {
            const distance = item.distance.toFixed(2);

            return {
              ...item,
              distance: +distance === 0 ? "Ở gần bạn" : `Khoảng ${distance} km`,
              isSender: item.isSender === 1 ? true : false,
            };
          }),
        },
        status: true,
      });
    } catch (error) {
      console.error("Error user near you:", error);
      res.status(500).json({
        message: "Error user near you: " + error.message,
        status: false,
      });
      next(error);
    }
  }

  async getUsersAsYouKnownAPI(req, res, next) {
    try {
      const { userId } = req.query;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;
      if (page < 1 || limit < 1) {
        return res.status(400).json({
          status: false,
          message: "Page và limit phải lớn hơn 1",
        });
      }
      const response = await getUsersAsYouKnown({ userId, limit, page: page });
      return res.json({
        data: response,
      });
    } catch (error) {
      console.error("Error getUsersAsYouKnown:", error);
      res.status(500).json({
        message: "Error getUsersAsYouKnown: " + error.message,
        status: false,
      });
      next(error);
    }
  }

  async getFriendInviteAPI(req, res, next) {
    try {
      const { id } = req.body.userInfo;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;
      if (page < 1 || limit < 1) {
        return res.status(400).json({
          status: false,
          message: "Page và limit phải lớn hơn 1",
        });
      }

      const friendInvite = await getFriendInvite({ userId: id, limit, page });
      return res.status(200).json({
        data: friendInvite,
        message: "Lấy danh sách lời mời kết bạn thành công",
        status: true,
      });
    } catch (error) {
      console.error("Error getFriendInvite:", error);
      res.status(500).json({
        message: "Error getFriendInvite: " + error.message,
        status: false,
      });
      next(error);
    }
  }

  async getMyFriendAPI(req, res, next) {
    try {
      const { id } = req.body.userInfo;
      const page = parseInt(req.query?.page, 10) || 1;
      const limit = parseInt(req.query?.limit, 10) || 20;
      if (page < 1 || limit < 1) {
        return res.status(400).json({
          status: false,
          message: "Page và limit phải lớn hơn 1",
        });
      }
      const response = await getMyFriend({ userId: id, limit, page });

      return res.status(200).json({
        data: response,
        message: "Lấy danh sách bạn bè thành công",
        status: true,
      });
    } catch (error) {
      console.error("Error getMyFriend:", error);
      res.status(500).json({
        message: "Error getMyFriend: " + error.message,
        status: false,
      });
      next(error);
    }
  }
}
const haversineQuery = (lat, lon, limit, offset, userId) => {
  return `
      SELECT 
        u.id as user_id, 
        u.fullname, 
        u.avatar_url, 
        u.latitude, 
        u.longitude,
        fs.status AS friend_status,
        calculated_distance.distance,
        CASE 
          WHEN fs.status = 'pending' AND fs.user_send_id = ${userId} THEN true
          WHEN fs.status = 'pending' AND fs.user_send_id != ${userId} THEN false
          ELSE false
        END AS isSender
      FROM user u
      LEFT JOIN friend_ship fs
        ON (fs.user_send_id = u.id AND fs.user_received_id = ${userId})
        OR (fs.user_send_id = ${userId} AND fs.user_received_id = u.id)
      INNER JOIN (
        SELECT 
          id AS user_id,
          (6371 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) 
            * cos(radians(longitude) - radians(${lon})) 
            + sin(radians(${lat})) * sin(radians(latitude))
          )) AS distance
        FROM user
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL
      ) AS calculated_distance
      ON calculated_distance.user_id = u.id
      WHERE 
        u.longitude IS NOT NULL 
        AND u.latitude IS NOT NULL 
        AND u.is_locked = 'OPEN'
        AND u.delflag = 0
        AND u.id != ${userId}
        AND calculated_distance.distance < 10
      ORDER BY calculated_distance.distance
      LIMIT ${limit} OFFSET ${offset};
    `;
};

async function blobToString(blob) {
  try {
    const text = await blob.text();
    console.log("Converted text:", text);
    return text;
  } catch (error) {
    console.error("Error converting blob to string:", error);
  }
}
module.exports = new FriendController();
