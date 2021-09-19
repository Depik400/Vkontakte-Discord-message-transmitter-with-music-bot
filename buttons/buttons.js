const mongo = require("../Tables").playlists;

class DiscordButton {
  constructor(client) {
    this.client = client;
    this.button = require("discord-buttons");
    this.button(client);
  }

  async getButton(id, args) {
    switch (id) {
      case "help": {
        console.log("here");
        let transmitter = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Трансмиттер")
          .setID("7")
          .setDisabled();

        let music = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Музыка")
          .setID("8")
          .setDisabled();

        let playlist = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Плейлист")
          .setID("playlists");

        let queue = new this.button.MessageButton()
          .setStyle("green")
          .setLabel("Очередь")
          .setID("queue");

        return new this.button.MessageActionRow().addComponents(
          transmitter,
          music,
          queue,
          playlist
        );
      }

      case "queue": {
        let previous = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Предыдущая")
          .setID("prev");

        let stop = new this.button.MessageButton()
          .setStyle("red")
          .setLabel("Стоп")
          .setID("stop");

        let next = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Следующая")
          .setID("next");
        let shuffle = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Перемешать")
          .setID("queue_shuffle");
        let playlist = new this.button.MessageButton()
          .setStyle("green")
          .setLabel("Плейлист")
          .setID("playlists");

        let queue = new this.button.MessageButton()
          .setStyle("green")
          .setLabel("Очередь")
          .setID("queue");

        return new this.button.MessageActionRow().addComponents(
          previous,
          stop,
          next,
          shuffle,
          playlist
        );
      }

      case "current_music": {
        let previous = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Предыдущая")
          .setID("prev");

        let stop = new this.button.MessageButton()
          .setStyle("red")
          .setLabel("Стоп")
          .setID("stop");

        let next = new this.button.MessageButton()
          .setStyle("blurple")
          .setLabel("Следующая")
          .setID("next");

        let queue = new this.button.MessageButton()
          .setStyle("green")
          .setLabel("Очередь")
          .setID("queue");

        return new this.button.MessageActionRow().addComponents(
          previous,
          stop,
          next,
          queue
        );
      }

      case "playlists": {
        if (args == undefined) return "none";
        var server_id = args.server;
        var current_page = args.page;
        const playlists = async (server_id) => {
          return await mongo.find({ server: server_id }).exec();
        };
        var list = await playlists(server_id);

        var list_size = Math.ceil(list.length/3);

        if (current_page == undefined) current_page = 0;

        //console.log(list_size);

        var btnarray = [];
        for (let index = current_page*3; index < Object.keys(list).length; index++) {
          btnarray.push(
            new this.button.MessageButton()
              .setStyle("blurple")
              .setLabel(`Запустить ${list[index].name}`)
              .setID(`playlist_play ${list[index].name}`)
          );
          if (index == current_page + 2) break;
        }

        let arrows = [];
        let queue =   new this.button.MessageButton()
        .setStyle("green")
        .setLabel("Очередь")
        .setID("queue");
        let next_page = new this.button.MessageButton()
        .setStyle("green")
        .setLabel(">")
        .setID("next_page");
        let prev_page = new this.button.MessageButton()
        .setStyle("green")
        .setLabel("<")
        .setID("previous_page")

        arrows.push(queue);

        if(current_page + 1 > 1){
          arrows.push(prev_page);
        }

        if(current_page + 1 < list_size && list_size > 1){
          arrows.push(next_page);
        }

        let object = [{ type: 1, components: btnarray },{ type: 1, components: arrows }]

        return object;
      }

      default: {
        return "none";
      }
    }
  }
}

module.exports = DiscordButton;
