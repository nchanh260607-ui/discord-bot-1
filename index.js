require('dotenv').config();

const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildModeration, 
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Bộ nhớ đệm chống gộp log
let lastLogId = null;
let lastLogCount = 0;

client.once('ready', () => {
    console.log(`Bot Sochill đã sẵn sàng lên sóng!`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Tránh log spam của bot
    if (newState.member.user.bot) return;

    const logChannelId = '1519695706942869565'; 
    const logChannel = newState.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // ==========================================
    // 1. VÀO KÊNH THOẠI (VOICE CHANNEL JOIN)
    // Lúc trước không ở kênh nào (old = null), giờ vào 1 kênh (new có giá trị)
    // ==========================================
    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00') // Màu xanh lá
            .setTitle('📥 Tham gia kênh thoại')
            .setDescription(`<@${newState.member.id}> đã tham gia 🔊 **${newState.channel.name}**`)
            .setTimestamp()
            .setFooter({ text: '🏠Home Chill🏡' });
        
        return logChannel.send({ embeds: [embed] });
    }

    // ==========================================
    // 2. CHUYỂN KÊNH THOẠI (VOICE CHANNEL MOVE)
    // ==========================================
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        
        // Đợi 2 giây cho Discord cập nhật log
        await new Promise(resolve => setTimeout(resolve, 2000));

        const fetchedLogs = await newState.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberMove,
        });

        const moveLog = fetchedLogs.entries.first();
        let executor = null;

        // Logic cải tiến: Kiểm tra thời gian và sự tồn tại của log
        // Không dùng target.id nữa vì nó hay bị undefined
        if (moveLog && (Date.now() - moveLog.createdTimestamp < 5000)) {
            executor = moveLog.executor;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🔄 Chuyển kênh thoại')
            .setDescription(`<@${newState.member.id}> đã chuyển kênh thoại.`)
            .addFields(
                { name: 'Từ:', value: `🔊 **${oldState.channel.name}**`, inline: true },
                { name: 'Sang:', value: `🔊 **${newState.channel.name}**`, inline: true }
            );

        // Hiển thị người thực hiện
        if (executor && executor.id !== newState.member.id) {
            // Nếu có Audit Log ghi lại hành động kéo
            embed.addFields({ name: '🛡️ Được kéo bởi:', value: `<@${executor.id}>` });
        } else {
            // Nếu không có log, xác định là họ tự di chuyển
            embed.addFields({ name: '👤 Người thực hiện:', value: `<@${newState.member.id}> (Tự di chuyển)` });
        }

        embed.setTimestamp()
             .setFooter({ text: '🏠Home Chill🏡' });
        
        return logChannel.send({ embeds: [embed] });
    }

    // ==========================================
    // 3. RỜI KÊNH THOẠI / BỊ KICK (VOICE CHANNEL LEAVE)
    // Kịch bản quen thuộc của anh em mình nãy giờ
    // ==========================================
    else if (oldState.channelId && !newState.channelId) {
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        const fetchedLogs = await oldState.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberDisconnect, 
        });

        const disconnectLog = fetchedLogs.entries.first();

        let isKicked = false;
        let executorUser = null;

        if (disconnectLog) {
            const { id, executor, createdAt, extra } = disconnectLog;
            const currentCount = extra ? parseInt(extra.count) : 1; 
            const timeDifference = Date.now() - createdAt.getTime();
            
            if (timeDifference < 10000 || (id === lastLogId && currentCount > lastLogCount)) {
                isKicked = true;
                executorUser = executor;
            }
            
            lastLogId = id;
            lastLogCount = currentCount;
        }

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: '🏠Home Chill🏡' });

        if (isKicked) {
            embed.setColor('#FF0000') 
                 .setTitle('🚨 Bị kick khỏi kênh thoại')
                 .setDescription(`<@${oldState.member.id}> đã bị ngắt kết nối khỏi 🔊 **${oldState.channel.name}**\n\n🛡️ **Người thực hiện:** <@${executorUser?.id}>`);
        } else {
            embed.setColor('#2B2D31') 
                 .setTitle('📤 Rời kênh thoại')
                 .setDescription(`<@${oldState.member.id}> đã rời 🔊 **${oldState.channel.name}**`);
        }

        return logChannel.send({ embeds: [embed] });
    }
});

// --- NHỚ THAY TOKEN CỦA ÔNG VÀO ĐÂY ---
client.login(process.env.DISCORD_TOKEN);

// ==========================================
// 1. LOG TIN NHẮN BỊ XÓA (MESSAGE DELETE)
// ==========================================
client.on('messageDelete', async message => {
    // Bỏ qua nếu tin nhắn bị xóa là của bot hoặc tin nhắn không có nội dung
    if (message.author?.bot) return; 

    const logChannelId = '1519695706942869565'; 
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Màu đỏ
        .setTitle('🗑️ Tin nhắn bị xóa')
        .setDescription(`**Người gửi:** <@${message.author.id}>\n**Kênh:** <#${message.channel.id}>\n\n**Nội dung đã xóa:**\n${message.content || '*[Chỉ chứa ảnh/video hoặc file đính kèm]*'}`)
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' }); //
    
    logChannel.send({ embeds: [embed] });
});


// ==========================================
// 2. LOG TIN NHẮN BỊ SỬA (MESSAGE EDIT)
// ==========================================
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    // Bỏ qua nếu nội dung không đổi (Discord hay báo lỗi ảo khi load ảnh)
    if (oldMessage.content === newMessage.content) return; 

    const logChannelId = '1519695706942869565';
    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#FFA500') // Màu cam
        .setTitle('✏️ Tin nhắn bị chỉnh sửa')
        .setDescription(`**Người gửi:** <@${oldMessage.author.id}>\n**Kênh:** <#${oldMessage.channel.id}>`)
        .addFields(
            { name: '📝 Trước khi sửa:', value: oldMessage.content || '*[Trống]*' },
            { name: '📝 Sau khi sửa:', value: newMessage.content || '*[Trống]*' }
        )
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' }); //
    
    logChannel.send({ embeds: [embed] });
});


// ==========================================
// 3. LOG THÀNH VIÊN VÀO SERVER (MEMBER JOIN)
// ==========================================
client.on('guildMemberAdd', member => {
    const logChannelId = '1519695706942869565';
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#00FF00') // Màu xanh lá
        .setTitle('📥 Thành viên mới tham gia')
        .setDescription(`Chào mừng <@${member.id}> đã bay tới server!`)
        .setThumbnail(member.user.displayAvatarURL()) // Hiện avatar người đó góc phải
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' }); //
    
    logChannel.send({ embeds: [embed] });
});


// ==========================================
// 4. LOG THÀNH VIÊN RỜI SERVER (MEMBER LEAVE)
// ==========================================
client.on('guildMemberRemove', member => {
    const logChannelId = '1519695706942869565';
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#2B2D31') // Màu tối 
        .setTitle('📤 Thành viên rời đi')
        .setDescription(`<@${member.id}> đã rời khỏi server.`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' }); //
    
    logChannel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);

// ==========================================
// 1. LOG ĐỔI BIỆT DANH (NICKNAME CHANGE)
// ==========================================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannelId = '1519695706942869565'; 
    const logChannel = newMember.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Check biệt danh thay đổi
    if (oldMember.nickname !== newMember.nickname) {
        const embed = new EmbedBuilder()
            .setColor('#FFFF00') // Màu vàng cho nổi
            .setTitle('📛 Biệt danh đã thay đổi')
            .setDescription(`<@${newMember.id}>`)
            .addFields(
                { name: 'Trước đó:', value: oldMember.nickname || 'Không có', inline: true },
                { name: 'Hiện tại:', value: newMember.nickname || 'Không có', inline: true }
            )
            .setThumbnail(newMember.user.displayAvatarURL())
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }

    // ==========================================
    // 2. LOG CẤP ROLE (MEMBER ROLE ADD/REMOVE)
    // ==========================================
    // Check xem có thay đổi về role không
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    if (oldRoles.size !== newRoles.size) {
        // Tìm role vừa được thêm
        const addedRole = newRoles.find(role => !oldRoles.has(role.id));
        // Tìm role vừa bị mất
        const removedRole = oldRoles.find(role => !newRoles.has(role.id));

        // Phải dùng Audit Log để biết AI LÀ NGƯỜI CẤP ROLE
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
            limit: 1,
            type: addedRole ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberRoleUpdate,
        });
        const entry = fetchedLogs.entries.first();
        const executor = entry ? entry.executor : 'Không rõ';

        if (addedRole) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Role đã được cấp')
                .setDescription(`**Thành viên:** <@${newMember.id}>\n**Role:** <@&${addedRole.id}>\n**Cấp bởi:** <@${executor.id}>`)
                .setThumbnail(newMember.user.displayAvatarURL())
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } 
        else if (removedRole) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Role đã bị gỡ')
                .setDescription(`**Thành viên:** <@${newMember.id}>\n**Role:** <@&${removedRole.id}>\n**Gỡ bởi:** <@${executor.id}>`)
                .setThumbnail(newMember.user.displayAvatarURL())
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

// ==========================================
// 1. LOG TẠO KÊNH (CHANNEL CREATE)
// ==========================================
client.on('channelCreate', async channel => {
    if (!channel.guild) return; // Bỏ qua nếu là tin nhắn chờ (DM)
    
    const logChannelId = '1519695706942869565';
    const logChannel = channel.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    // Đợi 2 giây để móc Audit Log
    await new Promise(resolve => setTimeout(resolve, 2000));
    const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate,
    });
    
    const createLog = fetchedLogs.entries.first();
    let executor = null;

    if (createLog && createLog.target.id === channel.id && (Date.now() - createLog.createdTimestamp < 5000)) {
        executor = createLog.executor;
    }

    const embed = new EmbedBuilder()
        .setColor('#00FF00') // Màu xanh lá
        .setTitle('🆕 Kênh mới vừa được tạo')
        .addFields({ name: 'Tên kênh:', value: `<#${channel.id}>`, inline: true })
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' });

    if (executor) {
        embed.addFields({ name: '👤 Người tạo:', value: `<@${executor.id}>`, inline: true });
        embed.setThumbnail(executor.displayAvatarURL()); // Hiện Avatar người tạo
    }

    logChannel.send({ embeds: [embed] });
});

// ==========================================
// 2. LOG XÓA KÊNH (CHANNEL DELETE)
// ==========================================
client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    
    const logChannelId = '1519695706942869565';
    const logChannel = channel.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    await new Promise(resolve => setTimeout(resolve, 2000));
    const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
    });
    
    const deleteLog = fetchedLogs.entries.first();
    let executor = null;

    if (deleteLog && deleteLog.target.id === channel.id && (Date.now() - deleteLog.createdTimestamp < 5000)) {
        executor = deleteLog.executor;
    }

    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Màu đỏ
        .setTitle('🗑️ Kênh vừa bị xóa')
        // Vì kênh đã xóa nên không tag bằng <#id> được nữa, phải in ra chữ
        .addFields({ name: 'Tên kênh:', value: `**${channel.name}**`, inline: true }) 
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' });

    if (executor) {
        embed.addFields({ name: '👤 Người xóa:', value: `<@${executor.id}>`, inline: true });
        embed.setThumbnail(executor.displayAvatarURL()); // Hiện Avatar người xóa
    }

    logChannel.send({ embeds: [embed] });
});

// ==========================================
// 3. LOG CHỈNH SỬA KÊNH (CHANNEL UPDATE)
// ==========================================
client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    
    const logChannelId = '1519695706942869565';
    const logChannel = newChannel.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    await new Promise(resolve => setTimeout(resolve, 2000));
    const fetchedLogs = await newChannel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelUpdate,
    });
    
    const updateLog = fetchedLogs.entries.first();
    let executor = null;

    if (updateLog && updateLog.target.id === newChannel.id && (Date.now() - updateLog.createdTimestamp < 5000)) {
        executor = updateLog.executor;
    }

    const embed = new EmbedBuilder()
        .setColor('#FFA500') // Màu cam/vàng
        .setTitle('⚙️ Kênh vừa bị chỉnh sửa')
        .setDescription(`Kênh đang được nhắc đến: <#${newChannel.id}>`)
        .setTimestamp()
        .setFooter({ text: '🏠Home Chill🏡' });

    // Check xem có đổi tên kênh không
    if (oldChannel.name !== newChannel.name) {
        embed.addFields(
            { name: 'Tên cũ:', value: `**${oldChannel.name}**`, inline: true },
            { name: 'Tên mới:', value: `**${newChannel.name}**`, inline: true }
        );
    } else {
        // Tạo chuỗi tag người sửa, nếu API không kịp trả về thì để 'không xác định'
        const userTag = executor ? `<@${executor.id}>` : 'người dùng (không xác định)';
        
        // Chèn thẳng biến userTag vào mục Chi tiết
        embed.addFields({ 
            name: 'Chi tiết:', 
            value: `Đã thay đổi quyền, chủ đề hoặc cài đặt khác bởi ${userTag}` 
        });
    }

    if (executor) {
        embed.addFields({ name: '👤 Người sửa:', value: `<@${executor.id}>` });
        embed.setThumbnail(executor.displayAvatarURL()); // Hiện Avatar người sửa
    }

    logChannel.send({ embeds: [embed] });
});
client.login(process.env.DISCORD_TOKEN);
