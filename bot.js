const vkbot = require("./vkbot");
const dsbot = require("./discordbot");
const fs = require("fs");
const ytSearch = require("yt-search");
const mongo = require('./Tables');

function isCommand(ctx) {
  if (ctx.message.text[0] == "/") {
    return true;
  }
  return false;
}

async function UpdateMongo(vk_id, update) {
  let tempChat = await mongo.chats.findOneAndUpdate({ vk: vk_id }, update, {
    new: true,
    upsert: true,
  });
  tempChat.save();
}

async function getUserInfo(from_id) {
  //console.log(`main window vk id - ` + from_id);
  var res = await vkbot
    .execute("users.get", { user_ids: from_id, fields: ["photo_200"] })
    .then((result) => {
      return result[0];
    })
    .catch((err) => {
      console.log(err);
    });

  return await res;
}

async function GetMessageAttachementsFromVK(photo) {
  var returnedPhoto = { files: [], links: [] };
  for (let i = 0; i < Object.keys(photo).length; i++) {
    //console.log(photo[i]);
    switch (photo[i].type) {
      case "photo": {
        returnedPhoto.files.push(
          photo[i].photo.sizes[Object.keys(photo[i].photo.sizes).length - 1].url
        );
        break;
      }
      case "doc": {
        returnedPhoto.files.push({
          attachment: photo[i].doc.url,
          name: photo[i].doc.title,
        });
        break;
      }
      case "audio": {
        var videos = async (query) => {
          var results = await ytSearch(query);
          return results.videos.length > 1 ? results.videos[0] : null;
        };
        var searched_music = await videos(
          photo[i].audio.artist + " " + photo[i].audio.title
        );
        //console.log(searched_music);
        await returnedPhoto.links.push(searched_music.url);
        break;
      }
      case "video": {
        var original_link = "https://vk.com/video";
        returnedPhoto.links.push(
          original_link + photo[i].video.owner_id + "_" + photo[i].video.id
        );
        break;
      }
      case "link": {
        returnedPhoto.links.push(photo[i].link.url);
        break;
      }

      case "audio_message": {
        returnedPhoto.links.push("Записал голосое сообщение. Я - ");
        returnedPhoto.links.push(
          "https://memepedia.ru/wp-content/uploads/2020/09/kloun.jpg"
        );
        break;
      }
      case "sticker": {
        //console.log()
        returnedPhoto.files.push({
          attachment:
            photo[i].sticker.images[
              Object.keys(photo[i].sticker.images).length - 1
            ].url,
          name: "sticker.png",
        });
        break;
      }

      case "graffiti": {
        returnedPhoto.files.push({
          attachment: photo[i].graffiti.url,
          name: "graffiti.png",
        });
        break;
      }
    }
  }
  //   if (Object.keys(photo).length == 0) {
  //     returnedPhoto = "unknown";
  //   }
  return returnedPhoto;
}

async function sendMessageToDiscord(message, peer_id, from_id, photo) {
  //console.log('here 1');
  let json = JSON.parse(fs.readFileSync("./database.json"));
  let current_chat = json.find((e) => e.vk == peer_id);
  //console.log(current_chat);
  if (current_chat.discord == undefined) return;
  if (!current_chat.is_stoped) return;

  //console.log('here 3');
  let channel = dsbot.channels.cache.get(current_chat.discord);
  var user = await getUserInfo(from_id);
  //(channel);
  if (current_chat.webhook == undefined) {
    await channel
      .createWebhook(user.first_name + " " + user.last_name, {
        avatar: user.photo_200,
      })
      .then(async (result) => {
        //console.log("here");
        let files = await GetMessageAttachementsFromVK(photo);
        if (files.files != []) {
          result.send(message + " " + files.links, { files: files.files });
        } else result.send(message + files.links);
        let json = JSON.parse(fs.readFileSync("./database.json"));
        for (let i = 0; i < Object.keys(json).length; i++) {
          if (peer_id == json[i].vk) {
            {
              UpdateMongo(json[i].vk,{webhook:result.id});
              json[i].webhook = result.id;
              // console.log(json[i]);
            }
          }
        }
        fs.writeFileSync("./database.json", JSON.stringify(json, null, 2));
      })
      .catch((err) => {
        console.log(err);
      });
  } else {
    channel
      .fetchWebhooks(current_chat.webhook)
      .then((result) => {
        var webhook = result.first();
        webhook
          .edit({
            name: user.first_name + " " + user.last_name,
            avatar: user.photo_200,
          })
          .then(async (wb) => {
            let files = await GetMessageAttachementsFromVK(photo);
            if (files.files != []) {
              wb.send(message + " " + files.links, { files: files.files });
            } else wb.send(message + files.links);
          })
          .catch((err) => {});
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

vkbot.on((ctx) => {
  //console.log("Hello world");
  if (isCommand(ctx) && ctx.message.type == 'message_new') return;
  //console.log(`handle 1 ${ctx.message.text}`);
  //console.log(ctx.message);
  sendMessageToDiscord(
    ctx.message.text,
    ctx.message.peer_id,
    ctx.message.from_id,
    ctx.message.attachments
  );
});

function DiscordToVk(author, message, channel_id, attachments) {
  let database = JSON.parse(fs.readFileSync("./database.json"));
  let current = database.find((e) => e.discord == channel_id);
  if (current == undefined) return;
  if (!current.is_stoped) return;
  vkbot.sendMessage(current.vk, `[${author} from Discord] ${message}`);
  attachments.forEach((e) => {
    //console.log(e.name + " " + e.url);
    vkbot.sendMessage(
      current.vk,
      `[${author} from Discord] ${e.name}\n ${e.url}`
    );
  });
}

dsbot.on("message", (msg) => {
  if (msg.content.startsWith("/")) return;
  if (msg.author.bot || msg.webhookID) return;
  DiscordToVk(
    msg.author.username,
    msg.content,
    msg.channel.id,
    msg.attachments
  );
});

dsbot.on("ready", () => {
  console.log("ready");
});

(async function getChats() {
  let chat = await mongo.chats.find({}).exec();
  //console.log(chat);
  fs.writeFileSync('./database.json',JSON.stringify(chat,null,2));
})();

vkbot.startPolling();
