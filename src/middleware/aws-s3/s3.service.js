const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const uuid = require('uuid');

const s3UploadMedia = async ({ file, folderName }) => {
    const s3client = new S3Client({ region: 'ap-southeast-2', defaultsMode: 'standard' });

    try {
        let processedBuffer;
        let contentType;

        if (file.mimetype.startsWith('image/')) {
            // Xử lý ảnh: Chuyển đổi sang WebP và giảm chất lượng
            processedBuffer = await sharp(file.buffer)
                .webp({ quality: 50 })
                .toBuffer();
            contentType = 'image/webp';
        } else if (file.mimetype.startsWith('video/')) {
            // Đối với video, giữ nguyên buffer và MIME type
            processedBuffer = file.buffer;
            contentType = file.mimetype;
        } else {
            throw new Error('Unsupported file type');
        }

        // Định nghĩa tham số upload
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${folderName}/${uuid.v4()}${contentType === 'image/webp' ? '.webp' : '.mp4'}`, // Định dạng file
            Body: processedBuffer,
            ContentType: contentType,
        };

        // Upload file lên S3
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

const s3UploadMedias = async ({ files, folderName }) => {
    const uploadPromises = files.map((file) =>
        s3UploadMedia({ file, folderName })
    );

    try {
        const uploadedUrls = await Promise.all(uploadPromises);
        console.log('All Uploaded URLs:', uploadedUrls);
        return uploadedUrls;
    } catch (error) {
        console.error('Error uploading multiple files to S3:', error);
        throw error;
    }
};

module.exports = { s3UploadImage: s3UploadMedia, s3UploadImages:s3UploadMedias };
