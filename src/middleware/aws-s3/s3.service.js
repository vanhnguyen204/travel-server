
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Upload} = require('@aws-sdk/lib-storage')
const uuid = require("uuid");
const fs = require("fs");
const s3UploadImage = async ({ file, folderName }) => {
    console.log('File: ', file)
    const s3client = new S3Client({ region: 'ap-southeast-2' });
    // const fileData = fs.readFileSync(file.path);
   
    const processedImageBuffer = await sharp(file.buffer)
        .jpeg({ quality: 50 })  // Giảm chất lượng xuống 50% (tùy chọn, có thể thay đổi)
        .toBuffer(); 

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${folderName}/${uuid.v4()}-${file.originalname}`,
        Body: processedImageBuffer,
        ContentType: file.mimetype
    };

    try {
        await s3client.send(new PutObjectCommand(params));

        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`;
        return fileUrl;
    } catch (error) {
        console.error("Error uploading file to S3:", error);
        throw error;
    }
};

// const s3UploadImage = async ({ file, folderName }) => {
//     const s3client = new S3Client({ region: 'ap-southeast-2' });
//     const fileData = fs.readFileSync(file.path);
//     const uploadParams = {
//         Bucket: process.env.AWS_BUCKET_NAME,
//         Key: `${folderName}/${uuid.v4()}-${file.originalname}`,
//         Body: fileData,
//         ContentType: file.mimetype
//     };

//     try {
//         // Sử dụng Upload từ AWS SDK v3 giúp tải lên nhanh hơn
//         const upload = new Upload({
//             client: s3client,
//             params: uploadParams,
//             partSize: 5 * 1024 * 1024, // Kích thước phân mảnh (5MB)
//             leavePartsOnError: false
//         });

//         await upload.done();  // Tiến hành tải lên

//         const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${uploadParams.Key}`;
//         return fileUrl;
//     } catch (error) {
//         console.error("Error uploading file to S3:", error);
//         throw error;
//     }
// };
module.exports = { s3UploadImage }

