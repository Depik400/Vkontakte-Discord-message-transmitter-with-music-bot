const discord = require("discord.js");
const token = require("./tokens");
const fs = require("fs");
const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");
const dsbot = new discord.Client();
const Genius = require("genius-lyrics");
const mongo = require("./Tables");
const { playlists } = require("./Tables");

const buttons = new (require("./buttons/buttons"))(dsbot);

const GeniusClient = new Genius.Client(token.genius);

dsbot.login(token.discord);

var musicDispatcher = [];
var playlistsDispatcher = new Map();

const exampleEmbed = new discord.MessageEmbed()
  .setColor("#0099ff")
  .setTitle("Сообщение от Бота")
  .setTimestamp()
  //.setThumbnail("https://i.ibb.co/SVSZMWY/bot.jpg")
  .setFooter("Спасибо за использование нашего бота", "https://ibb.co/SVSZMWY");

function RewriteJSON(secure_code, channel_id) {
  var database = JSON.parse(fs.readFileSync("./database.json"));

  for (let i = 0; i < Object.keys(database).length; i++) {
    if (database[i].secret == secure_code) {
      database[i].discord = channel_id;
      UpdateMongo(database[i].vk, { discord: channel_id });
    }
  }

  fs.writeFileSync("./database.json", JSON.stringify(database, null, 2));
}

function CheckCurrentChannel(channel_id) {
  var database = JSON.parse(fs.readFileSync("./database.json"));

  let object = database.find((e) => e.discord == channel_id);

  if (object != undefined) return false;
  return true;
}

function getCurrentChat(channel_id) {
  let json = JSON.parse(fs.readFileSync("./database.json"));
  let currentchat = json.find((e) => e.discord == channel_id);
  return currentchat;
}

async function UpdateMongo(vk_id, update) {
  let tempChat = await mongo.chats.findOneAndUpdate({ vk: vk_id }, update, {
    new: true,
    upsert: true,
  });
  tempChat.save();
}

function CommandHandler(ctx, msg) {
  var cmd = {
    command: msg.slice(1).split(" ")[0],
    args: msg.slice(1).split(" ").slice(1).join(" "),
  };
  if (cmd.args == undefined) cmd.args = "";
  console.log(
    `Сервер - ${ctx.guild.name} : Новая команда - ${cmd.command} ${
      cmd.args == "" ? ", аргуметов нет" : `аргументы ${cmd.args}`
    }`
  );
  return cmd;
}

async function CommandEvent(ctx, channel_id, cmd, type) {
  var voice_channel_member = "";
  if (type == "btn") {
    voice_channel_member = ctx.clicker.member;
    ctx = ctx.message;
  } else {
    voice_channel_member = ctx.member;
    //console.log("Check");
  }

  //console.log(voice_channel_member);

  switch (cmd.command) {
    case "bind": {
      if (cmd.args == "") {
        return { title: "Привязка чата", message: "Нет аргументов" };
      }
      if (CheckCurrentChannel(channel_id)) {
        RewriteJSON(cmd.args, channel_id);
        return { title: "Привязка чата", message: "bind success" };
      } else {
        return { title: "Привязка чата", message: "bind failed" };
      }
      break;
    }
    //Постановка трансмиттера на паузу
    case "pause": {
      let currentchat = getCurrentChat(channel_id);

      if (currentchat == undefined) {
        return { title: "Ошибка чатов", message: "Данный чат не привязан" };
      }

      currentchat.is_stoped = false;
      UpdateMongo(currentchat.vk, { is_stoped: false });
      fs.writeFileSync("./database.json", JSON.stringify(json, null, 2));
      return {
        title: "Взаимодействие с чатом",
        message: "Чат успешно поставлен на паузу",
      };
    }
    //Снятие трансмиттера с паузы
    case "unpause": {
      let currentchat = getCurrentChat(channel_id);
      if (currentchat == undefined) {
        return { title: "Ошибка чатов", message: "Данный чат не привязан" };
      }
      currentchat.is_stoped = true;
      UpdateMongo(currentchat.vk, { is_stoped: true });
      fs.writeFileSync("./database.json", JSON.stringify(json, null, 2));
      return {
        title: "Взаимодействие с чатом",
        message: "Чат успешно снят с паузы",
      };
    }
    case "status": {
      let currentchat = getCurrentChat(channel_id);

      return {
        title: "Статус чата",
        message: `Ваш канал связан с чатом, ваш ключ - ${
          currentchat.secret
        }, пересылка ${currentchat.is_stoped ? "включена" : "выключена"}`,
      };
    }
    case "help": {
      return {
        title: "Помощь",
        message:
          "\nСвязка вк с дискордом:\n\n/delete - удаляет ваш чат из базы и обрывает связь\n/bind Прикрепляет ваш чат к каналу в дискорде\n" +
          "/secret - Возвращает секретный ключ\n /status - Вовращает текущий статус чата\n" +
          "/pause - Ставит чат на паузу\n /unpause - Запускает пересылку заново\n/clear-msg - Очищает чат\n" +
          "\nМузыка:\n\n/play <название музыки> - запускает музыку \n/next - пропускает играющую песню\n" +
          "/next <индекс> - включает песню под указанным номером\n/next_out <индекс> - ставит песню в очередь без моментального переключения\n" +
          "/queue - Выводит очередь в чат\n/queue_shuffle - Перемешивает треки в очереди\n" +
          "/remove_queue <индекс> удаляет песню из очереди \n/text - иногда выводит нужный текст песни" +
          "\n\nПлейлист:\n\n/playlists - выводит список ваших плейлистов\n/playlist_add <название> - Создает новый плейлист из текущей очереди\n" +
          "/playlist_remove <название> - Удаляет существующий плейлист\n/playlist_play <название> - Добавляет в очередь плейлист\n" +
          "/playlist_update <Название> - Добавляет в существующий плейлист " +
          "текущую очередь\n\n\n",
      };
    }
    case "play": {
      //Если сервер не найден, то добавляем его в список
      if (musicDispatcher.find((e) => e.server == ctx.guild.id) == undefined) {
        let current_server = {
          server: ctx.guild.id,
          channel: ctx.channel,
          queue: [],
          played: false,
          skip: false,
          timer: "",
          interval: "",
          connection: "",
          current_music: 0,
        };
        musicDispatcher.push(current_server);
      }
      //console.log(musicDispatcher);
      //console.log(cmd);
      //Запускаем музыку
      if (cmd.args == "")
        return {
          title: "Взаимодействие с чатом",
          message: "Отсутствует название песни",
        };
      playMusic(ctx, cmd.args, voice_channel_member, "none");
      return {
        title: "Взаимодействие с чатом",
        message: "",
      };
    }

    case "text": {
      const text_worker = async (ctx, song) => {
        const lyrics = async (song) => {
          try {
            //console.log(song);
            var e = await GeniusClient.songs.search(song);
            return e;
          } catch (err) {
            console.log(err);
            return "none";
          }
        };
        const replacer = (song) => {
          song = song.replace(/(\-)|\([A-Za-z0-9,.\s]+\)/g, "");
          song = song.replace(/(\s\s+)/, " ").slice(0, -1);
          //console.log(song);
          return song.toLowerCase();
        };

        const result = await lyrics(replacer(song));
        try {
          const text_of_song = await result[0].lyrics();
          ctx.channel.send(
            exampleEmbed
              .setTitle(`Текст песни - ${song}`)
              .setDescription(text_of_song)
          );
        } catch (err) {
          ctx.channel.send(
            exampleEmbed
              .setTitle(`Текст песни - ${song}`)
              .setDescription("Ничего не найдено")
          );
          console.log("nothing");
        }
      };
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Поиск текста",
          message: "На вашем сервере еще не играла музыка",
        };
      if (musicDispatcher[current_chat_index].queue.length > 0) {
        let name_of_song =
          musicDispatcher[current_chat_index].queue[
            musicDispatcher[current_chat_index].current_music
          ].title;
        text_worker(ctx, name_of_song);
        return {
          title: "Поиск текста",
          message: "Идет поиск текста",
        };
      } else {
        return {
          title: "Ошибка",
          message: "Ничего не играет",
        };
      }
      return "error";
    }

    case "queue": {
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });
      var string = "\n";
      var index = 1;
      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере еще не играла музыка",
        };
      //console.log("В чате");
      if (musicDispatcher[current_chat_index].queue.length > 0) {
        if (musicDispatcher[current_chat_index].current_music > 4) {
          musicDispatcher[current_chat_index].queue.splice(
            0,
            musicDispatcher[current_chat_index].current_music
          );
          musicDispatcher[current_chat_index].current_music = 0;
        }

        for (let item of musicDispatcher[current_chat_index].queue) {
          if (musicDispatcher[current_chat_index].current_music == index - 1) {
            string += `\`\`\`yaml\n${index}. ${item.title}\`\`\`\n`;
          } else {
            string += `${index}. ${item.title}\n`;
          }
          index++;
        }
      } else
        return {
          title: "Очередь",
          message: "Очередь пуста",
        };

      return {
        title: "Очередь",
        message: string,
      };
    }
    case "queue_shuffle": {
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере еще не играла музыка",
        };

      if (musicDispatcher[current_chat_index].queue.length > 0) {
        const current_index = musicDispatcher[current_chat_index].current_music;
        const current_song =
          musicDispatcher[current_chat_index].queue[current_index].title;
        const shuffle = async (array) => {
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
        };
        musicDispatcher[current_chat_index].queue = await shuffle(
          musicDispatcher[current_chat_index].queue
        );

        let shuffleIndex = musicDispatcher[current_chat_index].queue.findIndex(
          function (item, i) {
            return item.title == current_song;
          }
        );

        [
          musicDispatcher[current_chat_index].queue[shuffleIndex],
          musicDispatcher[current_chat_index].queue[current_index],
        ] = [
          musicDispatcher[current_chat_index].queue[current_index],
          musicDispatcher[current_chat_index].queue[shuffleIndex],
        ];
        return {
          title: "Очередь",
          message: "Очередь отсортирована в случайном порядке",
        };
      } else
        return {
          title: "Очередь",
          message: "Очередь пуста",
        };
    }
    case "prev":
    case "next_out":
    case "next": {
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере еще не играла музыка",
        };

      if (musicDispatcher[current_chat_index].queue.length <= 0) {
        return {
          title: "Очередь",
          message: "Очередь пуста",
        };
      }

      if (cmd.args == "" && cmd.command !== "prev") {
        if (musicDispatcher[current_chat_index].connection != "none")
          try {
            musicDispatcher[current_chat_index].connection.dispatcher.end();
          } catch (err) {
            console.log(err);
          }
        return {
          title: "Очередь",
          message: "Включаю следующую песню",
        };
      }

      if (cmd.command !== "prev") cmd.args--;
      else {
        cmd.args = musicDispatcher[current_chat_index].current_music - 1;
        // console.log("args - " + cmd.args);
      }

      if (
        cmd.args >= musicDispatcher[current_chat_index].queue.length ||
        cmd.args < 0
      )
        return {
          title: "Очередь",
          message: "Данной песни не существует",
        };

      let current_sound = musicDispatcher[current_chat_index].current_music;

      if (
        current_sound + 1 <
        musicDispatcher[current_chat_index].queue.length
      ) {
        console.log(
          `замена ${
            musicDispatcher[current_chat_index].queue[current_sound + 1]
          } на ${musicDispatcher[current_chat_index].queue[current_sound + 1]}`
        );
        [
          musicDispatcher[current_chat_index].queue[current_sound + 1],
          musicDispatcher[current_chat_index].queue[cmd.args],
        ] = [
          musicDispatcher[current_chat_index].queue[cmd.args],
          musicDispatcher[current_chat_index].queue[current_sound + 1],
        ];
      } else {
        console.log(
          `Добавление в очередь ${
            musicDispatcher[current_chat_index].queue[cmd.args]
          }`
        );
        musicDispatcher[current_chat_index].queue.push(
          musicDispatcher[current_chat_index].queue[cmd.args]
        );
      }
      if (cmd.command == "next" || cmd.command == "prev") {
        try {
          musicDispatcher[current_chat_index].connection.dispatcher.end();
        } catch (err) {
          console.log(err);
        }
        return {
          title: "Очередь",
          message: `Запуск песни ${
            musicDispatcher[current_chat_index].queue[current_sound + 1].title
          }`,
        };
      }
      if (cmd.command == "next_out") {
        return {
          title: "Очередь",
          message: `Следующая песня ${
            musicDispatcher[current_chat_index].queue[current_sound + 1].title
          }`,
        };
      }
      return {
        title: "Очередь",
        message: "Ошибка",
      };
    }
    case "remove_queue": {
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      cmd.args--;

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере не играла музыка",
        };

      if (cmd.args >= musicDispatcher[current_chat_index].queue.length)
        return {
          title: "Очередь",
          message: "Не найдена данная песня",
        };

      if (cmd.args == musicDispatcher[current_chat_index].current_music) {
        return {
          title: "Очередь",
          message: "Невозможно удалить текущую песню",
        };
      }

      let deleted_sound = musicDispatcher[current_chat_index].queue[cmd.args];
      console.log(`Удаляющий индекс ${cmd.args}`);

      if (cmd.args < musicDispatcher[current_chat_index].current_music) {
        musicDispatcher[current_chat_index].current_music--;
      }

      musicDispatcher[current_chat_index].queue.splice(cmd.args, 1);
      return {
        title: "Очередь",
        message: `${deleted_sound.title} удалена из очереди`,
      };
    }
    case "stop": {
      let current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });
      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере не играла музыка",
        };
      if (musicDispatcher[current_chat_index].connection != "none") {
        musicDispatcher[current_chat_index].current_music = -1;
        musicDispatcher[current_chat_index].queue = [];
        try {
          musicDispatcher[current_chat_index].connection.dispatcher.end();
        } catch (err) {
          console.log(err);
        }
      }
      return {
        title: "Очередь",
        message: "Музыка остановлена",
      };
    }
    case "playlist_add": {
      var current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      if (cmd.args == "") {
        return {
          title: "Плейлист",
          message: "Необходимо указать имя нового плейлиста",
        };
      }

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Очередь",
          message: "На вашем сервере не играла музыка",
        };
      if (musicDispatcher[current_chat_index].queue.length < 1)
        return {
          title: "Плейлист",
          message: "Ваша очередь на музыку пуста, нечего добавить в плейлист",
        };
      let playlist_from_db = await mongo.playlists
        .find({ name: cmd.args, server: ctx.guild.id })
        .exec();
      console.log(playlist_from_db);
      if (playlist_from_db.length < 1) {
        var playlist = new mongo.playlists();
        playlist.server = ctx.guild.id;
        playlist.name = cmd.args;
        playlist.queue = musicDispatcher[current_chat_index].queue;
        playlist.save();
        return {
          title: "Плейлист",
          message: "Добавлен новый плейлист",
        };
      }
      return {
        title: "Плейлист",
        message: `Данный плейлист существует, если вы хотите добавить существующую очередь в этот плейлист, используйте /playlist_update ${cmd.args}`,
      };
    }
    case "playlists": {
      let playlists = await mongo.playlists
        .find({ server: ctx.guild.id })
        .exec();
      let page = playlistsDispatcher.get(ctx.guild.id).page;
      if (page == undefined) page = 0;

      let message = "";
      if (playlists.length < 1) {
        message = "У вас нет плейлистов";
      } else {
        for (
          let index = page * 3;
          index < Object.keys(playlists).length;
          index++
        ) {
          message += `\n\`\`\`yaml\nПлейлист - ${playlists[index].name}\`\`\`\n`;
          for (queue_obj of playlists[index].queue) {
            message += `${queue_obj.title}\n`;
          }
          if (index == page + 2) break;
        }
      }
      return {
        title: "Плейлист",
        message: message,
      };
    }
    case "playlist_remove": {
      if (cmd.args == "") {
        return {
          title: "Плейлист",
          message: "Необходимо указать имя удаляемого плейлиста",
        };
      }
      let delete_result = await mongo.playlists
        .deleteOne({ server: ctx.guild.id, name: cmd.args })
        .exec();
      //console.log(delete_result);
      let msg = "Не найдено данного плейлиста";
      if (delete_result.deletedCount > 0) {
        msg = "Удален плейлист - " + cmd.args;
      }
      return {
        title: "Плейлист",
        message: msg,
      };
    }
    case "playlist_play": {
      if (cmd.args == "") {
        return {
          title: "Плейлист",
          message: "Необходимо указать имя удаляемого плейлиста",
        };
      }
      var current_playlist = await mongo.playlists.find({
        server: ctx.guild.id,
        name: cmd.args,
      });
      if (current_playlist.length < 1)
        return {
          title: "Плейлист",
          message: "Данного плейлиста не существует",
        };
      //console.log(current_playlist);
      var current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });
      if (musicDispatcher[current_chat_index] == undefined) {
        let current_server = {
          server: ctx.guild.id,
          channel: ctx.channel,
          queue: [],
          played: false,
          skip: false,
          timer: "",
          interval: "",
          connection: "",
          current_music: 0,
        };
        // console.log(ctx.member);
        let popped = current_playlist[0].queue.pop();
        current_server.queue = current_playlist[0].queue;
        musicDispatcher.push(current_server);
        playMusic(ctx, popped.title, voice_channel_member, type);
      } else if (musicDispatcher[current_chat_index].queue.length < 1) {
        let popped = current_playlist[0].queue.pop();
        musicDispatcher[current_chat_index].queue = current_playlist[0].queue;
        playMusic(ctx, popped.title, voice_channel_member, type);
      } else {
        var i = 0;
        for (i; i < Object.keys(current_playlist[0].queue).length; i++) {
          //console.log(current_playlist[0].queue[i]);
          musicDispatcher[current_chat_index].queue.push(
            current_playlist[0].queue[i]
          );
        }
      }
      return {
        title: "Плейлист",
        message: "Плейлист добавлен в очередь",
      };
    }
    case "playlist_update": {
      if (cmd.args == "") {
        return {
          title: "Плейлист",
          message: "Необходимо указать имя обновляемого плейлиста",
        };
      }
      var current_playlist = await mongo.playlists.find({
        server: ctx.guild.id,
        name: cmd.args,
      });
      if (current_playlist.length < 1)
        return {
          title: "Плейлист",
          message: "Данного плейлиста не существует",
        };

      var current_chat_index = musicDispatcher.findIndex(function (item, i) {
        return item.server == ctx.guild.id;
      });

      if (musicDispatcher[current_chat_index] == undefined)
        return {
          title: "Плейлист",
          message: "На вашем сервере не играла музыка",
        };
      if (musicDispatcher[current_chat_index].queue.length < 1)
        return {
          title: "Плейлист",
          message: "Ваша очередь на музыку пуста, нечего добавить в плейлист",
        };
      //console.log(current_playlist);
      let updated = await mongo.playlists.findOneAndUpdate(
        { _id: current_playlist[0]._id },
        {
          $push: {
            queue: { $each: musicDispatcher[current_chat_index].queue },
          },
        },
        { upsert: true }
      );
      updated.save();
      //console.log(updated);
      return {
        title: "Плейлист",
        message: `Плейлист ${updated.name} обновлен`,
      };
    }
  }
  return {
    title: "Очередь",
    message: "Ошибка",
  };
  //console.log(cmd);
}

async function playMusic(ctx, args, voice_channel_member, type) {
  if (args == undefined) {
    ctx
      .reply(
        exampleEmbed
          .setTitle("Ошибка очереди")
          .setDescription("Укажите песню или ссылку на ютуб")
      )
      .then((m) => m.delete({ timeout: 7000 }));
    return "error";
  }
  let current_chat_index = musicDispatcher.findIndex(function (item, i) {
    return item.server == ctx.guild.id;
  });
  // console.log(`index of chat ${current_chat_index}`);
  const videoFinder = async (query) => {
    const videoResults = await ytSearch(query);
    return videoResults.videos.length > 1 ? videoResults.videos[0] : null;
  };
  var video_url = await videoFinder(args);
  if (musicDispatcher[current_chat_index].queue.length == 0) {
    if (!ctx.member.voice.channel) {
      ctx
        .reply(
          exampleEmbed
            .setTitle("Ошибка")
            .setDescription("Вы не в голосовом чате")
        )
        .then((m) => m.delete({ timeout: 7000 }));
      return "error";
    }
    if (video_url == null) {
      ctx
        .reply(
          exampleEmbed.setTitle("Ошибка").setDescription("Ничего не найдено")
        )
        .then((m) => m.delete({ timeout: 7000 }));
      return "error";
    }
    musicDispatcher[current_chat_index].queue.push(video_url);
  } else {
    if (video_url == null) {
      ctx
        .reply(
          exampleEmbed.setTitle("Ошибка").setDescription("Ничего не найдено")
        )
        .then((m) => m.delete({ timeout: 7000 }));
      return "error";
    }
    musicDispatcher[current_chat_index].queue.push(video_url);
    ctx.channel
      .send(
        exampleEmbed
          .setTitle("Очередь")
          .setDescription("Новая песня в очереди - " + video_url.title)
      )
      .then((m) => m.delete({ timeout: 7000 }));
  }

  var voice_channel = "none";
  try {
    if (type != "btn") {
      voice_channel = await voice_channel_member.voice.channel;
      // console.log("Here - voice channel");
    } else {
      voice_channel = await voice_channel_member.voice.channel;
      //console.log("Here - ctx govno")
    }
  } catch (err) {
    // console.log("error");
    voice_channel = "none";
    musicDispatcher[current_chat_index].queue = [];
  }
  // console.log(voice_channel);
  if (voice_channel == "none") {
    ctx.channel
      .send(
        exampleEmbed
          .setTitle("Очередь1")
          .setDescription("Вы не в голосовом канале")
      )
      .then((m) => m.delete({ timeout: 7000 }));
    return;
  }

  if (musicDispatcher[current_chat_index].played === false) {
    try {
      musicDispatcher[current_chat_index].connection =
        await voice_channel.join();
      console.log("connection to voice channel");
      MusicToVoice(current_chat_index);
    } catch (err) {
      musicDispatcher[current_chat_index].queue = [];

      ctx.channel
        .send(
          exampleEmbed
            .setTitle("Очередь2")
            .setDescription("Вы не в голосовом канале")
        )
        .then((m) => m.delete({ timeout: 7000 }));
      return;
    }
  }
}

async function MusicToVoice(current_chat_index) {
  musicDispatcher[current_chat_index].played = true;
  var link =
    musicDispatcher[current_chat_index].queue[
      musicDispatcher[current_chat_index].current_music
    ];
  const stream = ytdl(link.url, { filter: "audioonly" });
  musicDispatcher[current_chat_index].channel.send({
    embed: exampleEmbed.setTitle("Текущая песня").setDescription(link.title),
    component: await buttons.getButton("current_music", "none"),
  });
  musicDispatcher[current_chat_index].connection
    .play(stream, { seek: 0, volume: 1 })
    .on("finish", () => {
      musicDispatcher[current_chat_index].current_music++;
      if (
        musicDispatcher[current_chat_index].current_music ==
        musicDispatcher[current_chat_index].queue.length
      ) {
        musicDispatcher[current_chat_index].connection.disconnect();
        musicDispatcher[current_chat_index].connection = "none";
        musicDispatcher[current_chat_index].current_music = 0;
        musicDispatcher[current_chat_index].queue = [];
        musicDispatcher[current_chat_index].played = false;
      } else {
        //musicDispatcher[current_chat_index].current_music++;
        MusicToVoice(current_chat_index);
      }
    });
  //await timeout((link.duration.seconds + 2) * 1000, current_chat_index);
}

function timeout(ms, current_chat_index) {
  return new Promise((resolve) => {
    musicDispatcher[current_chat_index].timer = setTimeout(() => {
      clearInterval(musicDispatcher[current_chat_index].interval);
      resolve();
    }, ms);
    musicDispatcher[current_chat_index].interval = setInterval(() => {
      if (musicDispatcher[current_chat_index].skip === true) {
        clearTimeout(musicDispatcher[current_chat_index].timer);
        clearInterval(musicDispatcher[current_chat_index].interval);
        musicDispatcher[current_chat_index].skip = false;
        resolve();
      }
    }, 1000);
  });
}

dsbot.on("message", (msg) => {
  //sdconsole.log(msg.channel.id);
  if (msg.author.bot || msg.webhookID) return;
  if (!msg.content.startsWith("/")) return;
  if (msg.content == "/clear-msg") {
    async function wipe() {
      var message_size = 100;
      while (message_size == 100) {
        await msg.channel
          .bulkDelete(100)
          .then((messages) => (message_size = messages.size))
          .catch(console.error);
      }
    }
    wipe();
    msg.reply("Чат очищен!");
    return;
  }
  const Result = async (msg, content, id) => {
    var commands = CommandHandler(msg, content);
    var resultny = await CommandEvent(msg, id, commands, "not_btn");
    var result = resultny.message;
    var title = resultny.title;
    if (result == "no args") {
      msg.reply("Отсутствуют аргументы, шаблон команды /bind <секретный код>");
      return;
    }
    if (result == "bind success") {
      msg.reply("Данный чат успешно привязан к чату вконтакте");
      return;
    }
    if (result == "bind failed") {
      msg.reply("Произошла ошибка");
      return;
    }

    if (result == "success command") {
      msg.reply("Команда выполнена успешно!");
      return;
    }
    if (result == "error") {
      msg.reply("Ошибка при выполнении команды");
      return;
    }

    if (result != "") {
      var btn = await buttons.getButton(commands.command, {
        server: msg.guild.id,
        page: 0,
      });
      var messageReply = "";
      if (btn !== "none") {
        messageReply = {
          embed: exampleEmbed.setDescription(result).setTitle(title),
          components: btn,
        };
      } else {
        messageReply = {
          embed: exampleEmbed.setDescription(result).setTitle(title),
        };
      }
      msg.channel.send(messageReply);
    }
  };
  Result(msg, msg.content, msg.channel.id);
});

function playlists_page(btn) {
  if (btn.id == "next_page") {
    let temp = playlistsDispatcher.get(btn.message.guild.id);
    temp.page++;
    playlistsDispatcher.set(btn.message.guild.id, temp);
    return "playlists";
  }
  if (btn.id == "previous_page") {
    let temp = playlistsDispatcher.get(btn.message.guild.id);
    if (temp.page > 0) temp.page--;
    playlistsDispatcher.set(btn.message.guild.id, temp);
    return "playlists";
  }
  return btn.id;
}

dsbot.on("clickButton", async (btn) => {
  btn.reply.defer();

  var id = await playlists_page(btn);
  var commands = CommandHandler(btn.message, "/" + id);
  var resultny = await CommandEvent(
    btn,
    btn.message.channel.id,
    commands,
    "btn"
  );
  var result = resultny.message;
  var title = resultny.title;

  if (result != "")
    var btnn = await buttons.getButton(commands.command, {
      server: btn.message.guild.id,
      page: playlistsDispatcher.get(btn.message.guild.id).page,
    });

  var msg = "";
  if (btnn !== "none") {
    msg = {
      embed: exampleEmbed.setDescription(result).setTitle(title),
      components: btnn,
    };
  } else {
    msg = {
      embed: exampleEmbed.setDescription(result).setTitle(title),
    };
  }
  btn.message.channel.send(msg).then((msg) => msg.delete({ timeout: 15000 }));
});

dsbot.once("ready", () => {
  dsbot.guilds.cache.forEach(function (value, key, map) {
    playlistsDispatcher.set(key, { page: 0 });
  });
  //console.log(playlistsDispatcher);
});

module.exports = dsbot;
