import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const fetchImageAsBufferAndSaveAsFile = async (imageUrl,
    outputFolder
) => {
    try {
        // Tải ảnh từ URL
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }

        // Chuyển đổi ảnh sang buffer
        const buffer = Buffer.from(await response.arrayBuffer());

        // Tạo folder nếu chưa tồn tại
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        // Tạo tên file từ URL
        const fileName = path.basename(new URL(imageUrl).pathname);
        const outputPath = path.join(outputFolder, fileName);

        // Lưu buffer ra file
        fs.writeFileSync(outputPath, buffer);

        console.log(`Image saved to: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error('Lỗi khi tải và lưu ảnh:', error);
        throw error;
    }
};

// Sử dụng hàm
const imageUrl = 'https://nodejs-vstagram-aws-s3.s3.ap-southeast-2.amazonaws.com/images/Animals_Three_cheerful_frog_106628_.jpg';
// const outputFolder = path.resolve('src/public/images');

// fetchImageAsBufferAndSaveAsFile(imageUrl, outputFolder)
//     .then(filePath => {
//         console.log('Image successfully saved at:', filePath);
//     })
//     .catch(error => {
//         console.error('Error:', error.message);
//     });



const fetchImageAsBase64 = async (imageUrl) => {
    try {
        // Tải ảnh từ URL
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }

        // Chuyển đổi ảnh sang buffer
        const buffer = Buffer.from(await response.arrayBuffer());

        // Chuyển buffer thành chuỗi base64
        const base64 = buffer.toString('base64');

        return base64; // Trả về base64
    } catch (error) {
        console.error('Lỗi khi tải ảnh:', error);
        throw error;
    }
};
fetchImageAsBase64(imageUrl)
    .then(res => {
        console.log('Base 64: ', res.length, ' typeof ', typeof res)
    })
    .catch(e => {
        console.log('Error ', e)
    })


export {
    fetchImageAsBase64
}