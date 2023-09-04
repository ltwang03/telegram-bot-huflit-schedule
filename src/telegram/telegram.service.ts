import { Injectable } from '@nestjs/common';
import { Command, Ctx, InjectBot, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import axios from 'axios';
import * as qs from 'qs';
import * as cheerio from 'cheerio';
import { ConfigService } from '@nestjs/config';

@Update()
@Injectable()
export class TelegramService {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private configService: ConfigService,
  ) {}
  @Command('schedule')
  async main(@Ctx() ctx) {
    const [message] = await Promise.all([ctx.message]);
    const [command, mssv] = message.text.split(' ');
    if (!mssv) {
      await ctx.reply('Không có thời khoá biểu!');
    } else {
      const cookie = await this.getCookie();
      const [termId, weekId, yearStudy] = await this.getPropertiesOnSchedule(
        cookie,
      );
      const config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://portal.huflit.edu.vn/Home/DrawingStudentSchedule?StudentId=${mssv}&YearId=${yearStudy}&TermId=${termId}&WeekId=39&t=0.17878936288560876`,
        headers: {
          Cookie: cookie,
        },
      };
      try {
        const response = await axios.request(config);
        const html = response.data;
        const $ = cheerio.load(html);
        const studentName = $('div span:last-child')
          .text()
          .trim()
          .replace('Thời khóa biểu sinh viên:', '🧑‍🎓');
        const tkb = [];
        $('tr')
          .map((i, el) => {
            if (i > 0) {
              $(el)
                .find('th')
                .map((i, el) => {
                  const result = $(el)
                    .text()
                    .substring(0, $(el).text().indexOf('('))
                    .replace('', '\n');
                  tkb.push(result);
                });
              $(el)
                .find('td>div')
                .map((i, el) => {
                  const content = $(el)
                    .text()
                    .split(/-(?=[A-Za-z])/);
                  tkb.push(content);
                });
            }
            return tkb;
          })
          .get();
        const content = tkb
          .toString()
          .replace(/,/g, '\n')
          .replace(/-Đã học:.+|Nội dung:.+/g, '');
        await ctx.reply(`${studentName}\n${content}`);
      } catch (e) {
        console.log(e);
      }
    }
  }

  getCookie = async () => {
    const userName = this.configService.get('TK');
    const password = this.configService.get('MK');
    const data = qs.stringify({
      txtTaiKhoan: userName,
      txtMatKhau: password,
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://portal.huflit.edu.vn/Login',
      headers: {
        authority: 'portal.huflit.edu.vn',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'vi,en;q=0.9',
        'cache-control': 'max-age=0',
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://portal.huflit.edu.vn',
        referer: 'https://portal.huflit.edu.vn/Login',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        Cookie: 'ASP.NET_SessionId=utjyjc0ejupgiqrbnnsmgu2c',
      },
      data: data,
    };
    try {
      const response = await axios.request(config);
      return response.config.headers.get('Cookie');
    } catch (e) {
      console.log(e);
    }
  };
  getPropertiesOnSchedule = async (cookie) => {
    const config = {
      method: 'get',
      url: 'https://portal.huflit.edu.vn/Home/Schedules',
      headers: {
        authority: 'portal.huflit.edu.vn',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'vi,en;q=0.9',
        'cache-control': 'max-age=0',
        cookie,
        'user-agent':
          'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1;',
      },
    };
    try {
      const response = await axios.request(config);
      const html = response.data;
      const $ = cheerio.load(html);
      const termId = $('#TermID').val();
      const week = $('#Week').val();
      const yearStudy = $('#YearStudy').val();
      return [termId, week, yearStudy];
    } catch (e) {
      console.log(e);
    }
  };
}
