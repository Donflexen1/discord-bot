require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= SLASH COMMAND REGISTRATION =================
const commands = [
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send ticket panel"),

  new SlashCommandBuilder()
    .setName("market")
    .setDescription("Submit a marketplace post")
    .addStringOption(opt =>
      opt.setName("type")
        .setDescription("looking or hiring")
        .setRequired(true)
        .addChoices(
          { name: "Looking for Devs", value: "looking" },
          { name: "Hiring", value: "hiring" }
        )
    )
    .addStringOption(opt =>
      opt.setName("details")
        .setDescription("Post details")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

client.once("ready", async () => {
  console.log(`✅ Online as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const GUILD_ID = "1414794058726903923";

await rest.put(
  Routes.applicationGuildCommands(client.user.id, GUILD_ID),
  { body: commands }
);

  console.log("✅ Slash commands registered");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async interaction => {

  // ---------- SLASH COMMANDS ----------
  if (interaction.isChatInputCommand()) {

    // TICKET PANEL
    if (interaction.commandName === "ticketpanel") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ content: "❌ Admin only", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Support Tickets")
        .setDescription("Click below to open a ticket")
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Open Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // MARKET SUBMISSION
    if (interaction.commandName === "market") {
      const type = interaction.options.getString("type");
      const details = interaction.options.getString("details");

      const reviewChannel = interaction.guild.channels.cache.find(
        ch => ch.name === "marketplace-review"
      );

      if (!reviewChannel)
        return interaction.reply({ content: "❌ Review channel missing", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(type === "looking" ? "🔍 Looking For Devs" : "💼 Hiring")
        .setDescription(details)
        .setFooter({ text: `By ${interaction.user.tag}` })
        .setColor("Yellow");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${type}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("reject")
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );

      reviewChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: "🕒 Submitted for review", ephemeral: true });
    }
  }

  // ---------- BUTTONS ----------
  if (interaction.isButton()) {

    // OPEN TICKET
    if (interaction.customId === "open_ticket") {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      channel.send({ content: `🎫 ${interaction.user}`, components: [closeRow] });
      return interaction.reply({ content: "✅ Ticket created", ephemeral: true });
    }

    // CLOSE TICKET + TRANSCRIPT
    if (interaction.customId === "close_ticket") {
      const transcript = await createTranscript(interaction.channel);

      const logChannel = interaction.guild.channels.cache.find(
        ch => ch.name === "ticket-logs"
      );

      if (logChannel) {
        logChannel.send({
          content: `📄 Transcript from ${interaction.channel.name}`,
          files: [transcript]
        });
      }

      await interaction.channel.delete();
    }

    // MARKET APPROVAL
    if (interaction.customId.startsWith("approve")) {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      const type = interaction.customId.split("_")[1];
      const target = interaction.guild.channels.cache.find(
        ch => ch.name === (type === "looking" ? "looking-for-devs" : "hiring")
      );

      if (target) target.send({ embeds: interaction.message.embeds });
      return interaction.message.delete();
    }

    if (interaction.customId === "reject") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      return interaction.message.delete();
    }
  }
});

client.login(process.env.TOKEN);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);