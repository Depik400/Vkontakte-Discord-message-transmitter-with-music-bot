const mongoose = require('mongoose');
const tokens = require('./tokens')
mongoose.connect('mongodb+srv://galina:'+tokens.mongoose+'@cluster0.ehnbj.mongodb.net/NodeJSBot?retryWrites=true&w=majority',{
    useUnifiedTopology: true,
    useFindAndModify:true,
    useNewUrlParser: true
})

const chats = mongoose.model('chats', new mongoose.Schema({
    vk: String,
    discord: String,
    secret: String,
    is_stoped: Boolean,
    webhook: String
}));

const playlists = mongoose.model('playlists', new mongoose.Schema({
    server: String,
    name:String,
    queue: Array
}))

module.exports = {
    mongoose: mongoose,
    chats: chats,
    playlists: playlists
}