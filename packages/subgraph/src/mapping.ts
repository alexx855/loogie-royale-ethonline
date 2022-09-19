import { BigInt } from "@graphprotocol/graph-ts";
import {
  Restart,
  Register,
  Move,
  NewCurseDrop,
  NewHealthDrop,
} from "../generated/Game/Game";
import { WorldMatrix, Player, Game } from "../generated/schema";

export function handleRestart(event: Restart): void {
  // let gameString = event.params.gameId.toString();

  let game = Game.load("hackfs");
  if (game === null) {
    game = new Game("hackfs");
  }

  game.height = event.params.height;
  game.width = event.params.width;
  game.createdAt = event.block.timestamp;
  game.restart = event.block.number;
  game.winner = event.params.winner;
  game.nextCurse = BigInt.fromI32(10);
  game.gameOn = false;
  game.curseCount = 0;
  game.ticker = BigInt.fromI32(0);
  game.save();

  for (let i = 0; i < event.params.width; i++) {
    for (let j = 0; j < event.params.height; j++) {
      const fieldId = i.toString() + "-" + j.toString();
      let field = WorldMatrix.load(fieldId);
      if (field === null) {
        field = new WorldMatrix(fieldId);
        field.x = i;
        field.y = j;
      }
      field.cursed = false;
      field.player = null;
      field.healthAmountToCollect = BigInt.fromI32(0);
      field.save();
    }
  }

  game.save();
}

export function handleRegister(event: Register): void {
  let playerString = event.params.txOrigin.toHexString();
  let player = Player.load(playerString);

  if (player === null) {
    player = new Player(playerString);
  }
  // add initial player data
  player.loogieId = event.params.loogieId;
  player.health = BigInt.fromI32(100);
  player.x = event.params.x;
  player.y = event.params.y;
  player.createdAt = event.block.timestamp;
  player.transactionHash = event.transaction.hash.toHex();
  player.lastActionTick = BigInt.fromI32(0);
  player.lastActionBlock = BigInt.fromI32(0);
  player.lastActionTime = BigInt.fromI32(0);
  player.save();

  // update player on world matrix
  const fieldId = event.params.x.toString() + "-" + event.params.y.toString();
  let field = WorldMatrix.load(fieldId);
  if (field !== null) {
    field.player = playerString;
    field.save();
  }

  // check if gameOn, when last player is registered and update game
  if (event.params.gameOn) {
    let gameString = "hackfs";
    const game = Game.load(gameString);
    if (game !== null) {
      game.gameOn = true;
      game.save();
    }
  }
}

export function handleMove(event: Move): void {
  let gameString = "hackfs";
  const game = Game.load(gameString);
  if (game !== null) {
    game.ticker = event.params.gameTicker;
    game.save();
  }

  let playerString = event.params.txOrigin.toHexString();
  let player = Player.load(playerString);

  if (player !== null) {
    const oldX = player.x;
    const oldY = player.y;

    // update player data
    player.health = event.params.health;
    player.x = event.params.x;
    player.y = event.params.y;
    player.lastActionTick = event.params.gameTicker;
    player.lastActionTime = event.block.timestamp;
    player.lastActionBlock = event.block.number;
    player.save();

    const oldFieldId = oldX.toString() + "-" + oldY.toString();
    let oldField = WorldMatrix.load(oldFieldId);

    const fieldId = event.params.x.toString() + "-" + event.params.y.toString();
    let field = WorldMatrix.load(fieldId);

    // check if player is not on the same field
    if (event.params.x !== oldX || event.params.y !== oldY) {
      // remove player from old field
      if (oldField !== null) {
        oldField.player = null;
        oldField.save();
      }

      // move player to new field
      if (field !== null) {
        field.player = playerString;
        field.healthAmountToCollect = BigInt.fromI32(0);
        field.save();
      }
    } else {
      // user did not move, so user fought
    }
  }
}

export function handleHealthNewDrop(event: NewHealthDrop): void {
  // update ticker
  const gameTicker = event.params.gameTicker;
  const gameString = "hackfs";
  const game = Game.load(gameString);
  if (game !== null) {
    game.ticker = gameTicker;
    game.save();
  }

  // remove old drop
  const oldFieldId =
    event.params.oldX.toString() + "-" + event.params.oldY.toString();
  let oldField = WorldMatrix.load(oldFieldId);
  if (
    oldField !== null &&
    oldField.healthAmountToCollect !== BigInt.fromI32(0)
  ) {
    oldField.healthAmountToCollect = BigInt.fromI32(0);
    oldField.save();
  }

  const fieldId =
    event.params.dropX.toString() + "-" + event.params.dropY.toString();
  let field = WorldMatrix.load(fieldId);
  if (field !== null) {
    // add health amount to collect
    field.healthAmountToCollect = field.healthAmountToCollect.plus(
      event.params.amount
    );

    field.save();
  }
}

export function handleNewCurseDrop(event: NewCurseDrop): void {
  // makes the external borders/rigs for curseDropCount on the world cursed
  const cursePositions = event.params.cursePositions;

  const curseDropCount = event.params.curseDropCount;
  const nextCurse = event.params.nextCurse;
  const gameTicker = event.params.gameTicker;

  // TODO: support for multiple games, allow players to create or join games
  const gameString = "openhack";

  const game = Game.load(gameString);
  if (game !== null) {
    game.ticker = gameTicker;
    game.nextCurse = nextCurse;
    game.curseCount = curseDropCount;
    game.save();
  }

  for (let i = 0; i < cursePositions.length; i++) {
    const cursePosition = cursePositions[i];
    const fieldId =
      cursePosition.x.toString() + "-" + cursePosition.y.toString();
    let field = WorldMatrix.load(fieldId);
    if (field !== null) {
      field.cursed = true;
      field.save();

      // update player health
      const playerString = field.player;
      if (playerString !== null) {
        const player = Player.load(playerString);
        if (player !== null) {
          player.health = player.health = BigInt.fromI32(0);
          player.save();
        }
      }
    }
  }
}
