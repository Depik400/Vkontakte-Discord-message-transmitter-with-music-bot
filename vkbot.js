const token = require("./tokens");
const VKBotAPI = require("node-vk-bot-api");
const fs = require("fs");
const mongo = require('./Tables');
const vkbot = new VKBotAPI(token.vk);
const start_peer_id = 2000000000;

function isCommand(text) {
  if (text[0] == "/") {
    var cmd = text.slice(1).split(" ");
    return {
      status: true,
      command: cmd[0],
      params: cmd.length > 1 ? cmd[1] : "unknown",
    };
  }
  return { status: false };
}

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function CommandHandler(msg) {
  var text = msg.message.text;
  var cmd = isCommand(text);
  if (!cmd.status) return "not command";

  if (msg.message.peer_id < start_peer_id) return "not group chat";

  switch (cmd.command) {
    case "bind": {
      var chat_object = {
        vk: msg.message.peer_id,
        discord: "",
        secret: makeid(10),
        is_stoped: true,
      };
      // console.log('here');
      if (!CheckCurrentChat(chat_object)) {
        msg.reply("Ваш чат уже привязан");
        return "error";
      }
      var e = writeJSON(chat_object);
      msg.reply(
        `Ваш чат под номером ${msg.message.peer_id} | секретный ключ - ${chat_object.secret}`
      );
      return "command";
      break;
    }
    case "secret": {
      let secret = GetSecret(msg.message.peer_id);
      if (secret != "none") msg.reply(`Ваш секретный ключ - ${secret}`);
      else {
        msg.reply(`Данный чат не привязан`);
      }
      break;
    }
    case "delete": {
      let json = getJSON();
      let temp = [];
      for (let i = 0; i < Object.keys(json).length; i++) {
        if (json[i].vk != msg.message.peer_id) {
          temp.push(json[i]);
        }else{
          mongo.chats.deleteOne({vk:json[i].vk},(err,video) => {
            console.log(json[i]+ "Удален");
          });
        }
      }
      fs.writeFileSync("./database.json", JSON.stringify(temp));
      msg.reply("Чат успешно удален");
      break;
    }
    case "pause": {
      let json = JSON.parse(fs.readFileSync("./database.json"));
      let currentchat = json.find((e) => e.vk == msg.message.peer_id);
      if (currentchat == undefined) {
        return "error";
      }
      currentchat.is_stoped = false;
      msg.reply("Чат поставлен на паузу");
      fs.writeFileSync("./database.json", JSON.stringify(json, null, 2));
      return;
    }
    case "unpause": {
      let json = JSON.parse(fs.readFileSync("./database.json"));
      let currentchat = json.find((e) => e.vk == msg.message.peer_id);
      if (currentchat == undefined) {
        return "error";
      }
      currentchat.is_stoped = true;
      msg.reply("Чат снят с паузы");
      fs.writeFileSync("./database.json", JSON.stringify(json, null, 2));
      return;
    }

    case "status": {
      let json = JSON.parse(fs.readFileSync("./database.json"));
      let currentchat = json.find((e) => e.vk == msg.message.peer_id);
      if (currentchat == undefined) {
        return "error";
      }
      msg.reply(
        `Ваш канал связан с чатом, ваш ключ - ${
          currentchat.secret
        }, пересылка ${currentchat.is_stoped ? "включена" : "выключена"}`
      );
      return;
    }
    case "help": {
      msg.reply(
        "\n/delete - удаляет ваш чат из базы и обрывает связь\n/bind Прикрепляет ваш чат к каналу в дискорде\n" +
        "/secret - Возвращает секретный ключ\n /status - Вовращает текущий статус чата\n"+
        "/pause - Ставит чат на паузу\n /unpause - Запускает пересылку заново"
      );
    }
    default: {
      return "error";
    }
  }
  return "";
}

function GetSecret(id) {
  let currentroom = getJSON().find((e) => e.vk == id);
  if(currentroom)
  return currentroom.secret;
  else return "none";
}

function CheckCurrentChat(current) {
  let chat_list = getJSON();
  let finded = chat_list.find((e) => e.vk == current.vk);
  if (finded == undefined) return true;
  return false;
}

function writeJSON(obj) {
  var base = getJSON();
  if (CheckCurrentChat(obj)) base.push(obj);
  let chat = new mongo.chats();
  chat.vk = obj.vk;
  chat.discord  = "";
  chat.secret = obj.secret;
  chat.is_stoped = true;
  chat.webhook = '';
  chat.save();
  fs.writeFileSync("./database.json", JSON.stringify(base, null, 2));
  return "";
}

function getJSON() {
  return JSON.parse(fs.readFileSync("./database.json"));
}

vkbot.on((msg, next) => {
  if(msg.message.type != 'message_new') return;
  let result = CommandHandler(msg);
  if (result == "command") {
    msg.reply(
      "Команда успешно выполнена, для для дальнейшей настройке перейдите в чат дискорда, в который хотите пересылать сообщения и введите /bind <секретный ключ>"
    );
    return;
  }
  if (result == "error") {
    msg.reply("Команда не распознана");
    return;
  }
  //console.log(msg.message.text);
  next();
});

module.exports = vkbot;
