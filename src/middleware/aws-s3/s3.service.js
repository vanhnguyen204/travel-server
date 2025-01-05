const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const uuid = require('uuid');

const s3UploadImage = async ({ file, folderName }) => {
    console.log('File:', file);

    const s3client = new S3Client({ region: 'ap-southeast-2' });

    try {
        // Chuyển đổi ảnh sang WebP và giảm chất lượng
        const processedImageBuffer = await sharp(file.buffer)
            .webp({ quality: 50 }) // Định dạng WebP, giảm chất lượng xuống 50%
            .toBuffer();

        // Định nghĩa tham số upload
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${folderName}/${uuid.v4()}.webp`, // Tên file với định dạng WebP
            Body: processedImageBuffer,
            ContentType: 'image/webp', // Định dạng WebP
        };

        // Upload ảnh lên S3
        await s3client.send(new PutObjectCommand(params));

        // Trả về URL của file đã upload
        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`;
        console.log('Uploaded File URL:', fileUrl);
        return fileUrl;
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        throw error;
    }
};

module.exports = { s3UploadImage };
