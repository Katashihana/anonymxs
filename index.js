require("dotenv").config();
const {
  WAConnection,
  MessageType,
  ReconnectMode,
} = require("@adiwajshing/baileys");
const fs = require("fs");
const chalk = require("chalk");
const {
  start,
  success,
  banner,
  totalUser,
} = require("./src/libs/connection.js");
const moment = require("moment-timezone");
const lang = require("./src/handler/message/language/ID_ind");

const mongoose = require("mongoose");
const db = require("./src/model/Contact");
mongoose.connect(`${process.env.MONGO_URI}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.on("connected", function () {
  console.log("Mongoose default connection open to " + process.env.MONGO_URI);
});

// If the connection throws an error
mongoose.connection.on("error", function (err) {
  console.log("Mongoose default connection error: " + err);
});

// When the connection is disconnected
mongoose.connection.on("disconnected", function () {
  console.log("Mongoose default connection disconnected");
});

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};
const setting = JSON.parse(fs.readFileSync("./src/libs/settings.json"));
prefix = setting.prefix;

const starts = async () => {
  const client = new WAConnection();
  client.autoReconnect = ReconnectMode.onConnectionLost;
  client.logger.level = "warn";
  console.log(banner.string);
  client.version = [2, 2143, 4];
  client.on("qr", () => {
    console.log(
      color("[", "white"),
      color("!", "red"),
      color("]", "white"),
      color(" Scan the qr code above")
    );
  });
  fs.existsSync("./state.json") && client.loadAuthInfo("./state.json");
  client.on("connecting", () => {
    start("2", "Connecting...");
  });
  client.on("open", () => {
    success("2", "Connected");
  });
  await client.connect({ timeoutMs: 30 * 1000 });
  const authInfo = client.base64EncodedAuthInfo();
  fs.writeFileSync("./state.json", JSON.stringify(authInfo, null, "\t"));

  client.on("chat-update", async (chat) => {
    try {
      if (!chat.hasNewMessage) return;
      chat = chat.messages.all()[0];
      if (!chat.message) return;
      if (chat.key && chat.key.remoteJid == "status@broadcast") return;
      if (chat.key.fromMe) return;
      global.prefix;
      global.blocked;

      const { text } = MessageType;
      const time = moment.tz("Asia/Jakarta").format("DD/MM HH:mm:ss");
      const from = chat.key.remoteJid;
      const type = Object.keys(chat.message)[0];
      body =
        type === "conversation" && chat.message.conversation.startsWith(prefix)
          ? chat.message.conversation
          : type == "imageMessage" &&
            chat.message.imageMessage.caption.startsWith(prefix)
          ? chat.message.imageMessage.caption
          : type == "videoMessage" &&
            chat.message.videoMessage.caption.startsWith(prefix)
          ? chat.message.videoMessage.caption
          : type == "extendedTextMessage" &&
            chat.message.extendedTextMessage.text.startsWith(prefix)
          ? chat.message.extendedTextMessage.text
          : "";
      const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
      const isCmd = body.startsWith(prefix);

      const ownerNumber = [`${setting.ownerNumber}@s.whatsapp.net`];
      const sender = chat.key.remoteJid;
      const isOwner = ownerNumber.includes(sender);
      const isGroup = from.endsWith("@g.us");
      const groupMetadata = isGroup ? await client.groupMetadata(from) : "";
      const groupMembers = isGroup ? groupMetadata.participants : "";

      colors = ["red", "white", "black", "blue", "yellow", "green"];
      // Database Query
      const findContact = async (contact) => {
        let findContact = await db.findOne({ contactId: contact });
        return findContact;
      };
      const chatContact = async () => {
        let chatContact = await db
          .findOne({ contactId: from })
          .where("partnerId")
          .ne(null);

        return chatContact;
      };
      const findContactPartner = async (contact) => {
        let findContactPartner = await db.findOne({
          status: 1,
          partnerId: contact,
        });
        return findContactPartner;
      };
      const sortPartnerId = async () => {
        return await db.findOne().sort({ status: 1 });
      };

      if (isCmd)
        console.log(
          "\x1b[1;31m~\x1b[1;37m>",
          "[\x1b[1;32mEXEC\x1b[1;37m]",
          time,
          color(command),
          "from",
          color(sender.split("@")[0])
        );

      if (!isCmd) {
        findContact(from)
          .then((res) => {
            if (res.partnerId !== null) {
              console.log(
                "\x1b[1;31m~\x1b[1;37m>",
                "[\x1b[1;32mChat\x1b[1;37m]",

                time,
                color("Message"),
                "from",
                color(sender.split("@")[0]),
                "to",
                color(res.partnerId.split("@")[0]),
                "messages:",
                color(chat.message.conversation, "blue")
              );
            } else {
              console.log(
                "\x1b[1;31m~\x1b[1;37m>",
                "[\x1b[1;31mChat\x1b[1;37m]",
                time,
                color("Message"),
                "from",
                color(sender.split("@")[0])
              );
            }
          })
          .catch((err) => {
            console.log(
              "\x1b[1;31m~\x1b[1;37m>",
              "[\x1b[1;31mChat\x1b[1;37m]",
              time,
              color("Message"),
              "from",
              color(sender.split("@")[0]),
              "error:",
              color(err, "red")
            );
          });
      }

      if (isGroup) {
        if (groupMembers.length > 0) {
          await client.sendMessage(from, lang.mess.error.isGroup, text);
          await client.groupLeave(from);
        }
      }

      if (!isCmd) {
        findContact(from)
          .then(async (res) => {
            let findContactResult = res;
            if (
              res.partnerId === from ||
              (res.partnerId !== null && res.status === 0)
            ) {
              res.status = 0;
              res.partnerId = null;
              await res.save();
            }
            if (res.partnerId === null && res.status === 0)
              return client.sendMessage(
                from,
                lang.mess.error.sessionNotFound,
                text
              );
            chatContact()
              .then(async (res) => {
                let contactResult = res;
                findContactPartner(contactResult.contactId)
                  .then(async (res) => {
                    //if (res.partnerId === from)
                    if (res.contactId === contactResult.partnerId) {
                      if (type === "conversation") {
                        client.sendMessage(
                          contactResult.partnerId,
                          chat.message.conversation,
                          text
                        );
                      } else if (type === "stickerMessage") {
                        //bayar
                      } else if (type === "locationMessage") {
                        //bayar
                      } else if (type === "imageMessage") {
                        //bayar
                      } else if (type === "videoMessage") {
                        //bayar
                      } else if (type === "documentMessage") {
                        //bayar
                      } else if (type === "contactMessage") {
                        //bayar
                      } else if (type === "audoMessage") {
                        //bayar
                      }
                    }
                  })
                  .catch(async (err) => {
                    findContactResult.status = 0;
                    findContactResult.partnerId = null;
                    await findContactResult.save();
                    client.sendMessage(
                      from,
                      lang.mess.error.isBrokenPartner,
                      text
                    );
                  });
              })
              .catch(async () => {
                client.sendMessage(from, lang.mess.error.sessionNotFound, text);
              });
          })
          .catch((err) => {
            console.log(err);

            return client.sendMessage(
              from,
              lang.mess.error.notRegistered,
              text
            );
          });
      }

      switch (command) {
        case "test":
          console.log(MessageType);
          break;
        case "help":
          totalUser().then((res) => {
            client.sendMessage(from, lang.help(res), text);
          });
          break;
        case "tnc":
          client.sendMessage(from, lang.tnc(), text);
          break;
        case "register":
          await findContact(from)
            .then(async (res) => {
              if (res === null) {
                await db.create({ contactId: from });
                client.sendMessage(from, lang.mess.registerSuccess, text);
              } else {
                client.sendMessage(from, lang.mess.error.isRegistered, text);
              }
            })
            .catch(() => {
              client.sendMessage(from, lang.mess.error.isRegistered, text);
            });
          break;

        case "unregister":
          findContact(from).then(async (res) => {
            if (res !== null) {
              await res.remove();
              await client.sendMessage(from, lang.mess.unRegisterSuccess, text);
            }
          });
          break;

        case "start":
          await findContact(from)
            .then(async (res) => {
              if (
                res.partnerId === from ||
                (res.partnerId !== null && res.status === 0)
              ) {
                res.status = 0;
                res.partnerId = null;
                await res.save();
                return;
              }
              const con = res;
              if (res.partnerId === null) {
                sortPartnerId()
                  .then(async (res) => {
                    if (res.partnerId === null) {
                      con.status = 1;
                      await con.save();
                      client.sendMessage(from, lang.mess.findPartner, text);
                      const findPartner = new Promise((resolve, reject) => {
                        setInterval(async () => {
                          const partnerQuery = await db
                            .findOne({ status: 1, partnerId: null })
                            .where("contactId")
                            .ne(from);
                          if (partnerQuery) {
                            resolve(partnerQuery);
                          } else {
                            reject(partnerQuery);
                          }
                        }, 100);
                      });
                      findPartner
                        .then(async (res) => {
                          const finder = await db.findOne({
                            contactId: from,
                          });
                          finder.partnerId = res.contactId;
                          res.partnerId = finder.contactId;
                          await finder.save();
                          await res.save();
                          client.sendMessage(
                            res.contactId,
                            lang.mess.partnerFound,
                            text
                          );
                          client.sendMessage(
                            res.partnerId,
                            lang.mess.partnerFound,
                            text
                          );
                        })
                        .catch(() => {
                          setTimeout(async () => {
                            findContact(from).then(async (res) => {
                              if (res.partnerId === null) {
                                client.sendMessage(
                                  from,
                                  lang.mess.error.partnerNotFound,
                                  text
                                );
                                res.status = 0;
                                await res.save();
                              }
                            });
                          }, 20000);
                        });
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                  });
              } else if (res.partnerId !== null) {
                const nonNullPartnerId = await db.findOne({
                  contactId: res.partnerId,
                });
                if (nonNullPartnerId.partnerId !== res.partnerId) {
                  res.status = 0;
                  res.partnerId = null;
                  await res.save();
                  client.sendMessage(
                    from,
                    lang.mess.error.isBrokenPartner,
                    text
                  );
                } else if (res.partnerId !== null && res.status !== 0) {
                  return client.sendMessage(
                    from,
                    lang.mess.error.isSession,
                    text
                  );
                }
              }
            })
            .catch(() => {
              client.sendMessage(from, lang.mess.error.notRegistered, text);
            });

          break;

        case "next":
          await findContact(from)
            .then(async (res) => {
              let con = res;
              if (res.status === 0)
                return client.sendMessage(
                  from,
                  lang.mess.error.sessionNotFound,
                  text
                );
              findContactPartner(con.contactId)
                .then(async (res) => {
                  client.sendMessage(
                    con.partnerId,
                    lang.mess.error.partnerStopSession,
                    text
                  );
                  con.status = 1;
                  con.partnerId = null;
                  await con.save();
                  res.partnerId = null;
                  res.status = 0;
                  await res.save();
                  client.sendMessage(from, lang.mess.error.nextSession, text);
                  const findPartner = new Promise((resolve, reject) => {
                    setInterval(async () => {
                      const partnerQuery = await db
                        .findOne({ status: 1, partnerId: null })
                        .where("contactId")
                        .ne(from);
                      if (partnerQuery) {
                        resolve(partnerQuery);
                      } else {
                        reject(partnerQuery);
                      }
                    }, 100);
                  });
                  findPartner
                    .then(async (res) => {
                      let con = res;
                      findContact(from)
                        .then(async (res) => {
                          res.partnerId = con.contactId;
                          con.partnerId = res.contactId;
                          await res.save();
                          await con.save();
                          client.sendMessage(
                            con.contactId,
                            lang.mess.partnerFound,
                            text
                          );
                          client.sendMessage(
                            res.partnerId,
                            lang.mess.partnerFound,
                            text
                          );
                        })
                        .catch((err) => {
                          client.sendMessage(
                            from,
                            lang.mess.error.notRegistered,
                            text
                          );
                        });
                    })
                    .catch(() => {
                      setTimeout(async () => {
                        findContact(from).then(async (res) => {
                          if (res.partnerId === null) {
                            client.sendMessage(
                              from,
                              lang.mess.error.partnerNotFound,
                              text
                            );
                            res.status = 0;
                            await res.save();
                          }
                        });
                      }, 20000);
                    });
                })
                .catch(async (err) => {
                  con.status = 0;
                  con.partnerId = null;
                  await con.save();
                  client.sendMessage(
                    from,
                    lang.mess.error.isBrokenPartner,
                    text
                  );
                });
            })
            .catch(() => {
              client.sendMessage(from, lang.mess.error.notRegistered, text);
            });

          break;
        case "stop":
          await findContact(from)
            .then(async (res) => {
              let con = res;
              if (res.status === 0)
                return client.sendMessage(
                  from,
                  lang.mess.error.sessionNotFound,
                  text
                );
              findContactPartner(from)
                .then(async (res) => {
                  client.sendMessage(
                    con.partnerId,
                    lang.mess.error.partnerStopSession,
                    text
                  );
                  con.status = 0;
                  con.partnerId = null;
                  await con.save();
                  res.status = 0;
                  res.partnerId = null;
                  await res.save();
                  client.sendMessage(from, lang.mess.error.stopSession, text);
                })
                .catch(async (err) => {
                  con.status = 0;
                  con.partnerId = null;
                  await con.save();
                  client.sendMessage(
                    from,
                    lang.mess.error.isBrokenPartner,
                    text
                  );
                });
            })
            .catch(() => {
              client.sendMessage(from, lang.mess.error.notRegistered, text);
            });

          break;
        case "bc":
          const getBcUser = await db.find().select("contactId");
          if (!isOwner)
            return client.sendMessage(from, "hanya command untuk owner");

          if (isOwner) {
            bctxt = body.slice(4);
            txtbc = `*BROADCAST*\n\n${bctxt}`;
            for (let i = 0; i < getBcUser.length; i++) {
              client.sendMessage(getBcUser[i].contactId, txtbc, text);
            }
          }
          break;
        case "restart":
          const getRsUser = await db.find().select("contactId");
          if (!isOwner)
            return client.sendMessage(from, "hanya command untuk owner");

          if (isOwner) {
            bctxt = body.slice(9);
            txtbc = `*SERVER RESTARTED*\n\n*Note:* ${bctxt}`;
            for (let i = 0; si < getRsUser.length; i++) {
              client.sendMessage(getRsUser[i].contactId, txtbc, text);
            }
          }
          break;
      }
    } catch (error) {
      console.log(error);
    }
  });
};
starts();
