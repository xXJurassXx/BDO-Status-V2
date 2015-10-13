"use strict";

const Constants = require("../Constants");
const Events = Constants.Events;
const Utils = require("../core/Utils");
const BaseCollection = require("./BaseCollection");

const GuildMember = require("../models/GuildMember");

function createGuildMember(member) {
	member.id = member.user.id;

	return new GuildMember({
		id: member.id,
		guild_id: member.guild_id,
		roles: member.roles,
		mute: member.mute,
		deaf: member.deaf,
		joined_at: member.joined_at // todo: convert strings into Date?
	});
}

function handleConnectionOpen(data) {
	this.clear();
	data.guilds.forEach(guild => {
		if (guild.unavailable) return;

		handleCreateGuild.call(this, guild);
	});
	return true;
}

function handleGuildMemberUpdate(member) {
	const memberCollection = this.get(member.guild_id);
	if (!memberCollection) return true;
	memberCollection.mergeOrSet(member.user.id, createGuildMember(member));
	return true;
}

function handleGuildMemberRemove(member) {
	const memberCollection = this.get(member.guild_id);
	if (!memberCollection) return true;
	memberCollection.delete(member.user.id);
	return true;
}

function handleCreateGuild(guild) {
	const memberCollection = new BaseCollection();
	this.set(guild.id, memberCollection);

	guild.members.forEach(member => {
		member.guild_id = guild.id;
		memberCollection.set(member.user.id, createGuildMember(member));
	});
	return true;
}

function handleDeleteGuild(guild) {
	this.delete(guild.id);
	return true;
}


class GuildMemberCollection extends BaseCollection {
	constructor(discordie, gateway) {
		super();

		if (typeof gateway !== "function")
			throw new Error("Gateway parameter must be a function");

		discordie.Dispatcher.on(Events.GATEWAY_READY, e => {
			if (e.socket != gateway()) return;
			(handleConnectionOpen.bind(this))(e.data);
		});
		discordie.Dispatcher.on(Events.GATEWAY_DISPATCH, e => {
			if (e.socket != gateway()) return;

			Utils.bindGatewayEventHandlers(this, e, {
				GUILD_CREATE: handleCreateGuild,
				GUILD_DELETE: handleDeleteGuild,
				GUILD_MEMBER_ADD: handleGuildMemberUpdate,
				GUILD_MEMBER_UPDATE: handleGuildMemberUpdate,
				GUILD_MEMBER_REMOVE: handleGuildMemberRemove
			});
		});

		this._discordie = discordie;
		Utils.privatify(this);
	}
	getMember(guildId, userId) {
		const memberCollection = this.get(guildId);
		if (!memberCollection) return true;
		return memberCollection.get(userId);
	}
}

module.exports = GuildMemberCollection;