import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import LocalSession from 'telegraf-session-local';
import { getSheetData } from './sheets';
import { CustomContext, SessionData, Product } from './types/session';

dotenv.config();

const bot = new Telegraf<CustomContext>(process.env.BOT_TOKEN!);

// Настройка сессии с правильным типом
const localSession = new LocalSession<SessionData>({
  database: 'session_db.json',
});
bot.use(localSession.middleware());

// Убедимся, что session всегда задана
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  return next();
});

// Конвертация строки таблицы в объект Product
function mapRowToProduct(row: any[]): Product {
  const [id, name, category, price, , quantity, photoUrl] = row;
  return { id, name, category, price, quantity, photoUrl };
}

// Команда /start — показываем кнопку "Меню"
bot.start(async (ctx) => {
    const firstName = ctx.update.message.from.first_name;

    await ctx.replyWithSticker('https://cdn2.combot.org/beer728/webp/0xf09faba5.webp');
    ctx.reply(
      `👋 Добро пожаловать ${ firstName }! Нажмите "Меню", чтобы начать.`,
      Markup.keyboard([['📋 Меню']]).resize().oneTime()
    );
  }
);


// Главное меню — выбор категории
bot.hears('📋 Меню', (ctx) =>
  ctx.reply(
    '📂 Выберите категорию:',
    Markup.keyboard([['🍺 Пиво', '🥨 Закуски']]).resize()
  )
);

// Раздел "Пиво" — выбор типа
bot.hears('🍺 Пиво', (ctx) =>
  ctx.reply(
    '🍻 Выберите тип пива:',
    Markup.keyboard([['🌞 Светлое', '🌑 Темное'], ['🔙 Назад'], ['🛒 Корзина']]).resize()
  )
);

// bot.on(message('text'), (ctx) => {
//   console.log('всё, что приходит:', ctx.message.text);
// });
//
// bot.catch((err, ctx) => {
//   console.error('Ошибка бота:', err);
// });

// Шаблоны закусок
bot.hears('🥨 Закуски', (ctx) =>
  ctx.reply(
    '🥨 Выберите подкатегорию закусок:',
    Markup.keyboard([
      ['🐟 Рыбные снеки', '🐠 Сушеная рыба'],
      ['🥜 Орехи/Кукуруза/Кранчи'],
      ['🍞 Чипсы/Гренки/Сухарики', '🧀 Сыр'],
      ['🔙 Назад'],
      ['🛒 Корзина']
    ]).resize()
  )
);

// Маппинг закусок
const snackSubcategories: Record<string, string> = {
  '🐟 Рыбные снеки': 'Рыбные снеки',
  '🐠 Сушеная рыба': 'Сушеная рыба',
  '🥜 Орехи/Кукуруза/Кранчи': 'Орехи/Кукуруза/Кранчи',
  '🍞 Чипсы/Гренки/Сухарики': 'Чипсы/Гренки/Сухарики',
  '🧀 Сыр': 'Сыр',
};

// Обработка закусок
for (const label in snackSubcategories) {
  bot.hears(label, async (ctx) => {
    const sub = snackSubcategories[label];
    const data = await getSheetData('Snacks!A2:G');
    const items = data?.filter(row => row[2] === sub && row[4] === 'TRUE') ?? [];

    if (items.length === 0) {
      return ctx.reply(
        '😕 Категория пуста.',
        Markup.keyboard([['🔙 Назад']]).resize()
      );
    }

    for (const row of items) {
      const p = mapRowToProduct(row);
      const cap = `📦 <b>${ p.name }</b>\n💰 ${ p.price }₴\n📊 Остаток: ${ p.quantity }`;
      const button = Markup.button.callback('Подробнее', `DETAIL_${ p.id }`);
      if (p.photoUrl) {
        await ctx.replyWithPhoto(p.photoUrl, { caption: cap, parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
      } else {
        await ctx.reply(cap, { parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
      }
    }
    ctx.session.lastMenu = 'snacks';
  });
}

// Типы пива
const beerTypes: Record<string, string> = {
  '🌞 Светлое': 'Светлое',
  '🌑 Темное': 'Темное'
};

// Обработка пива
for (const label in beerTypes) {
  bot.hears(label, async (ctx) => {
    const sub = beerTypes[label];
    const data = await getSheetData('Beer!A2:G');
    const items = data?.filter(row => row[2] === sub && row[4] === 'TRUE') ?? [];

    if (items.length === 0) {
      return ctx.reply(
        '😕 Категория пуста.',
        Markup.keyboard([['🔙 Назад']]).resize()
      );
    }

    for (const row of items) {
      const p = mapRowToProduct(row);
      const cap = `📦 <b>${ p.name }</b>\n💰 ${ p.price }₴\n📊 Остаток: ${ p.quantity }`;
      const button = Markup.button.callback('Подробнее', `DETAIL_${ p.id }`);
      if (p.photoUrl) {
        await ctx.replyWithPhoto(p.photoUrl, { caption: cap, parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
      } else {
        await ctx.reply(cap, { parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
      }
    }
    ctx.session.lastMenu = 'beer';
  });
}

// Обработка "Подробнее"
bot.action(/^DETAIL_(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const sheet = ctx.session.lastMenu === 'snacks' ? 'Snacks!A2:G' : 'Beer!A2:G';
  const data = await getSheetData(sheet);
  const row = data?.find(r => r[0] === id);
  if (!row) return ctx.reply('❌ Не найдено.');

  const p = mapRowToProduct(row);
  const cap = `📦 <b>${ p.name }</b>\nКатегория: ${ p.category }\n💰 ${ p.price }₴\n📊 Остаток: ${ p.quantity }`;
  const button = Markup.button.callback('➕ В корзину', `ADD_${ p.id }`);
  if (p.photoUrl) {
    await ctx.replyWithPhoto(p.photoUrl, { caption: cap, parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
  } else {
    await ctx.reply(cap, { parse_mode: 'HTML', ...Markup.inlineKeyboard([button]) });
  }
  await ctx.answerCbQuery();
});

// Обработка "Добавить в корзину"
bot.action(/^ADD_(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const sheet = ctx.session.lastMenu === 'snacks' ? 'Snacks!A2:G' : 'Beer!A2:G';
  const data = await getSheetData(sheet);
  const row = data?.find(r => r[0] === id);
  if (!row) return ctx.reply('❌ Не найдено.');

  ctx.session.pendingProduct = mapRowToProduct(row);
  await ctx.reply('Введите количество:');
  await ctx.answerCbQuery();
});


// Показ корзины  '🛒 Корзина'
bot.hears('🛒 Корзина', (ctx) => {
  const cart = ctx.session.cart;
  if (!cart?.length) return ctx.reply('🛒 Корзина пуста.');
  let tot = 0;
  const lines = cart.map(i => {
    const sum = i.price * i.qty;
    tot += sum;
    return `${ i.name } — ${ i.qty } x ${ i.price }₴ = ${ sum }₴`;
  });
  ctx.reply(`<b>🛒 Корзина:</b>\n${ lines.join('\n') }\n\n<b>Итого: ${ tot }₴</b>`, { parse_mode: 'HTML' });
});

// Кнопка "Назад"
bot.hears('🔙 Назад', (ctx) => {
  console.log('🔙 Назад', ctx);
  ctx.session.lastMenu = undefined;
  ctx.reply(
    '📂 Выберите категорию:',
    Markup.keyboard([['🍺 Пиво', '🥨 Закуски']]).resize()
  );
});

// Обработка количества и добавление в корзину
bot.on(message('text'), (ctx) => {
  const prod = ctx.session.pendingProduct;
  if (!prod) return; // Не вмешиваемся, если не ожидается ввод

  const qty = parseInt(ctx.message.text);
  if (!qty || qty <= 0) return ctx.reply('Введите число >0');

  ctx.session.cart = ctx.session.cart ?? [];
  ctx.session.cart.push({ id: prod.id, name: prod.name, price: +prod.price, qty });
  ctx.session.pendingProduct = undefined;
  ctx.reply(`✅ ${ prod.name } x${ qty } добавлен в корзину.`);
});

// Запуск
bot.launch().then(() => {
  console.log('✅ Бот запущен');
  bot.telegram.setMyCommands([
    { command: 'start', description: 'Начало' },
  ]);
});

// Корректное завершение
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
