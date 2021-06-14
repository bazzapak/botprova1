const { MessageEmbed } = require("discord.js");

module.exports = client => {
    client.on('message', message => {
        if (message.author.bot) return;
        if (message.content.startsWith(PREFIX)) {
            const [CMD_NAME, ...args] = message.content
                .trim()
                .substring(PREFIX.length)
                .split(/\s+/);
            if (CMD_NAME === 'help') {
                const content = `I comandi che puoi usare con i tuoi ruoli sono:\n\n**${PREFIX}help** - Questo comando ti permette di far apparire la lista dei comandi eseguibili\n**${PREFIX}status <nuovo stato>** - Questo comando ti permette di cambiare lo stato del bot\n**${PREFIX}purge <messaggi da cancellare>** - Questo comando ti permette di eliminare tanti messaggi quanti inseriti come argomento`;
                if (message.member.roles.cache.find(r => r.name === '【𝓐𝓶𝓸𝓷𝓰 𝓤𝓼】') || message.guild.ownerID === message.author.id) { 
                    client.users.fetch(message.member.id, false).then((user) => {
                        user.send(content);
                    })
                }
                else {
                    message.channel.bulkDelete(1).then(() => {
                            message.delete({ timeout: 4000 });
                    });
                    const content = `Mi dispiace, ma non ti è permesso di utilizzare questo comando!\n\nSe credi che si tratti di un errore, crea un ticket nella sezione apposita e cercheremo di aiutarti!`;
                    const embed = new MessageEmbed()
                        .setTitle(`Errore Utilizzo Comando ${PREFIX}help`)
                        .setColor(0xff2626)
                        .setDescription(content)
                        .setThumbnail('https://i.imgur.com/W9TPX4f.png');
                    client.users.fetch(message.member.id, false).then((user) => {
                        user.send(embed);
                    })
                }

            } 
        }
    })
}