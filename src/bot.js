require("dotenv").config();

const discord = require('discord.js');
const { Client, MessageAttachment, MessageEmbed } = require('discord.js');
const client = new Client({ partials: ['MESSAGE', 'REACTION'] });
const db = require('./database');
const Ticket = require('../models/Ticket');
const TicketConfig = require('../models/TicketConfig');
const { databaseVersion } = require("./database");
const purge = require('../commands/purge');
const help = require('../commands/help');

//aggiunte di prova
const fs = require('fs').promises;
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM();
const document = dom.window.document;

global.PREFIX = "p$";

client.on('ready', () => {
  console.log(`${client.user.tag} has logged in.`);
  purge(client);
  help(client);
  db.authenticate()
    .then(() => {
      console.log('Connesso al database');
      Ticket.init(db);
      TicketConfig.init(db);
      Ticket.sync();
      TicketConfig.sync();
    }).catch ((err) => console.log(err));
  client.user.setActivity(`${PREFIX}help`, ({type: "LISTENING"}))
});

client.on('message', async message => {
  if (message.author.bot) return;
  if (message.content.startsWith(PREFIX)) {
    const [CMD_NAME, ...args] = message.content
        .trim()
        .substring(PREFIX.length)
        .split(/\s+/);
    if (CMD_NAME === 'transcript') {
      let messageCollection = new discord.Collection();
      let channelMessages = await message.channel.messages.fetch({
        limit: 100
      }).catch(err => console.log(err));
      messageCollection = messageCollection.concat(channelMessages);
      while (channelMessages.size === 100) {
        let lastMessageId = channelMessages.lastKey();
        channelMessages = await message.channel.messages.fetch({ limit: 100, before: lastMessageId }).catch(err => console.log(err));
        if (channelMessages) {
          messageCollection = messageCollection.concat(channelMessages);
        }
      }
      let msgs = messageCollection.array().reverse();
      let data = await fs.readFile('./template.html', 'utf-8').catch(err => console.log(err));
      if (data) {
        await fs.writeFile('index.html', data).catch(err => console.log(err));
        let guildElement = document.createElement('div');
        guildElement.className = "centrato";
        let guildImage = document.createElement('img');
        guildImage.setAttribute('src', message.guild.iconURL());
        guildImage.setAttribute('width', '200');
        guildElement.appendChild(guildImage);
        console.log(guildElement.outerHTML);
        await fs.appendFile('index.html', guildElement.outerHTML).catch(err => console.log(err));
        msgs.forEach(async msg => {
          let parentContainer = document.createElement('div');
          parentContainer.className = "parent-container";
          let avatarDiv = document.createElement('div');
          avatarDiv.className = "avatar-container";
          let img = document.createElement('img');
          img.setAttribute('src', msg.author.displayAvatarURL());
          img.className = "avatar";
          avatarDiv.appendChild(img);
          parentContainer.appendChild(avatarDiv);
          let messageContainer = document.createElement('div');
          messageContainer.className = "message-container";
          let nameElement = document.createElement('span');
          let name = document.createTextNode(msg.author.tag + " " + msg.createdAt.toDateString() + " " + msg.createdAt.toLocaleTimeString() + " EST");
          nameElement.appendChild(name);
          messageContainer.append(nameElement); 
          if (msg.content.startsWith('```')) {
            let m = msg.content.replace(/```/g, "");
            let codeNode = document.createElement('code');
            let textNode = document.createTextNode(m);
            codeNode.appendChild(textNode);
            messageContainer.appendChild(codeNode);
          } else {
            let msgNode = document.createElement('span');
            let textNode = document.createTextNode(msg.content);
            msgNode.append(textNode);
            messageContainer.appendChild(msgNode);
          }
          parentContainer.appendChild(messageContainer);
          await fs.appendFile('index.html', parentContainer.outerHTML).catch(err => console.log(err));
        });
      }
    }
  }
})





client.on('message', async (message) => {
  if(message.author.bot || message.channel.type === 'dm') return;
  if(message.content.toLowerCase() === `${PREFIX}setup` && message.guild.ownerID === message.author.id) {
    try {
      const filter = (m) => m.author.id === message.author.id;
      message.channel.send('Inserisci l\'id del messaggio');
      const msgId = (await message.channel.awaitMessages(filter, { max: 1 })).first().content;
      const fetchMsg = await message.channel.messages.fetch(msgId);
      message.channel.send('Inserisci l\'id della categoria');
      const categoryId = (await message.channel.awaitMessages(filter, {max: 1})).first().content;
      const categoryChannel = client.channels.cache.get(categoryId);
      message.channel.send('Inserisci i ruoli che avranno accesso ai ticket');
      const roles = (await message.channel.awaitMessages(filter, {max: 1})).first().content.split(/,\s*/);
      if (fetchMsg && categoryChannel) {
        for (const roleId of roles) {
          if (!message.guild.roles.cache.get(roleId)) throw new Error('Il ruolo non esiste')
        }
        const ticketConfig = await TicketConfig.create({
          messageId: msgId,
          guildId: message.guild.id,
          roles: JSON.stringify(roles),
          parentId: categoryChannel.id
        });
        message.channel.send('Configurazione salvata nel database');
        await fetchMsg.react('📩');
      } else throw new Error('Campi invalidi');
    } catch(err) {
      console.log(err);
    }
  }
})

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name === '📩') {
    const ticketConfig = await TicketConfig.findOne({where: {messageId: reaction.message.id}});
    if (ticketConfig) {
      const findTicket = await Ticket.findOne({where: {authorId: user.id, resolved: false}});
      if (findTicket) {
        const message = 'Mi dispiace, ma hai già creato un ticket e quest\'ultimo è ancora aperto! Se vuoi creare un altro ticket, devi prima di tutto chiudere quello attuale!';
        const embed = new MessageEmbed()
          .setTitle('Errore Ticket')
          .setColor(0xff2626)
          .setDescription(message)
          .setThumbnail('https://i.imgur.com/W9TPX4f.png');
        user.send(embed);
      } else {
        console.log('Sto creando il ticket');
        try {
          const messaggiom = await reaction.message.channel.messages.fetch(ticketConfig.getDataValue('messageId'));
          messaggiom.reactions.resolve('📩').users.remove(user.id);
          const roleIsdString = ticketConfig.getDataValue('roles');
          console.log(roleIsdString);
          const roleIds = JSON.parse(roleIsdString);
          const permissions = roleIds.map((id) => ({ allow: 'VIEW_CHANNEL', id }));
          const channel = await reaction.message.guild.channels.create('ticket', {
            parent: ticketConfig.getDataValue('parentId'),
            permissionOverwrites: [
              { deny: 'VIEW_CHANNEL', id: reaction.message.guild.id},
              { allow: 'VIEW_CHANNEL', id: user.id},
              ...permissions
            ]
          });
          const msg = await channel.send('Clicca sulla reaction per chiudere questo ticket!');
          await msg.react('🔒');
          const ticket = await Ticket.create({
            authorId: user.id,
            channelId: channel.id,
            guildId: reaction.message.guild.id,
            resolved: false,
            closedMessageId: msg.id
          });
          const ticketId = String(ticket.getDataValue('ticketId')).padStart(4, 0);
          await channel.edit({name: `ticket-${ticketId}`});
        } catch (err) {
          console.log(err);
        }
      }
    } else {
      console.log('Nessuna configurazione trovata!');
    }
  } else if (reaction.emoji.name === '🔒') {
    const ticket = await Ticket.findOne({where: {channelId: reaction.message.channel.id}});
    if (ticket) {
      const closedMessageId = ticket.getDataValue('closedMessageId');
      if (reaction.message.id === closedMessageId) {
        await reaction.message.channel.updateOverwrite(ticket.getDataValue('authorId'), {
          VIEW_CHANNEL: false
        }).catch((err) => console.log(err));
        ticket.resolved = true;
        await ticket.save();
        reaction.message.channel.send(`**${user.username}** ha chiuso il ticket`)
        const msgMove = client.channels.cache.find(channel => channel.id === '850701915561656340');
        const date = ticket.getDataValue('createdAt');
        var day = date.getDate();
        var month = date.getMonth() + 1;
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        if (date.getHours() >= 0 && date.getHours() <= 9)
          hour = `0${date.getHours()}`;
        if (date.getMinutes() >= 0 && date.getMinutes() <= 9)
          min = `0${date.getMinutes()}`;
        if (date.getSeconds() >= 0 && date.getSeconds() <= 9)
          sec = `0${date.getSeconds()}`;
        if (date.getDate() >= 1 && date.getDate() <= 9)
          day = `0${date.getDate()}`;
        if (date.getMonth() >= 1 && date.getMonth() <= 9)
          month = `0${date.getMonth() + 1}`;
        const date1 = ticket.getDataValue('updatedAt');
        var day1 = date1.getDate();
        var month1 = date1.getMonth() + 1;
        var hour1 = date1.getHours();
        var min1 = date1.getMinutes();
        var sec1 = date1.getSeconds();
        if (date1.getHours() >= 0 && date1.getHours() <= 9)
          hour1 = `0${date1.getHours()}`;
        if (date1.getMinutes() >= 0 && date1.getMinutes() <= 9)
          min1 = `0${date1.getMinutes()}`;
        if (date1.getSeconds() >= 0 && date1.getSeconds() <= 9)
          sec1 = `0${date1.getSeconds()}`;
        if (date1.getDate() >= 1 && date1.getDate() <= 9)
          day1 = `0${date1.getDate()}`;
        if (date1.getMonth() >= 1 && date1.getMonth() <= 9)
          month1 = `0${date1.getMonth() + 1}`;  
        const messaggio = `**Ticket ID:** ${ticket.getDataValue('ticketId')}\n**Richiesto Da:** <@${ticket.getDataValue('authorId')}>\n**Chiuso Da:** <@${user.id}>\n**Data Creazione:** ${day}/${month}/${date.getFullYear()} - ${hour}:${min}:${sec}`;
        const embed = new MessageEmbed()
          .setTitle('Informazioni Ticket Chiuso')
          .setColor(0x6600ff)
          .setDescription(messaggio)
          .setFooter(`Data Chiusura: ${day1}/${month1}/${date.getFullYear()} - ${hour1}:${min1}:${sec1}`)
        msgMove.send(embed);
        client.users.fetch(ticket.getDataValue('authorId'), false).then((user) => {
          user.send(embed);
        })
        console.log('Sto aggiornando il ticket...');
        var nomecanale = reaction.message.channel.id;
        reaction.message.channel.delete();
        var sql = `DELETE FROM Tickets WHERE channelId = ${nomecanale}`;
        db.query(sql, function (err, result) {
          if(err) console.log(err);
          console.log(result.affectedRows);
        })
      }
    }
  }
})

client.login('ODQ0NjA0NDA5MDYxNDQxNTU4.YKU1Jw.fvNfxDEbS4fXIiAaXRQCaxZI2VE');
