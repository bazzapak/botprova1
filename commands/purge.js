module.exports = client => {
    client.on('message', async (message)=>{
        if (message.author.bot) return;
        if (message.content.startsWith(PREFIX)) {
            const [CMD_NAME, ...args] = message.content
                .trim()
                .substring(PREFIX.length)
                .split(/\s+/);
            if (CMD_NAME === 'purge') 
            {
                if (args.length == 1)
                {
                    var c = parseInt(args, 10);
                    var x = parseInt(c+1, 10);
                    message.channel.bulkDelete(x).then(() => {
                        message.channel.send('***```Ho eliminato '+ c +' messaggi```***')
                        .then(message => {
                            message.delete({ timeout: 4000 });
                        });
                    });
                }
                else if (args.length > 1)
                {
                    message.channel.bulkDelete(1).then(() => {
                        message.channel.send('***```Questo comando accetta solamente un parametro!```***')
                        .then(message => {
                            message.delete({ timeout: 4000 });
                        });
                    })
                }
                else
                {
                    message.channel.bulkDelete(1).then(() => {
                        message.channel.send('***```Per utilizzare questo comando devi inserire un parametro!```***')
                        .then(message => {
                            message.delete({ timeout: 4000 });
                        });
                    })
                }
            }
        }
    });
}