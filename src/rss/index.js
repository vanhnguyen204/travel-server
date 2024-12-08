const axios = require('axios');

const { htmlToText } = require('html-to-text');
const { parseStringPromise } = require('xml2js')
const cheerio = require('cheerio');
const parseRSS = async (rssUrl) => {
    try {
        const response = await axios.get(rssUrl);
        const xmlData = response.data;
        const jsonData = await parseStringPromise(xmlData, { trim: true, explicitArray: false });


        const items = jsonData.rss.channel.item.map((item) => {
            
            const $ = cheerio.load(item.description);
            const textContent = $('body').text();
            return ({
                title: item.title,
                description: textContent,
                pubDate: item.pubDate,
                link: item.link,
                image: item.enclosure['$'].url,
            })
        });
        return {
            title: jsonData.rss.channel.title,
            description: jsonData.rss.channel.description,
            pubDate: jsonData.rss.channel.pubDate,
            items,
        };
    } catch (error) {
        console.error('Error parsing RSS:', error);
        throw new Error('Failed to parse RSS feed');
    }
};

module.exports = { parseRSS }