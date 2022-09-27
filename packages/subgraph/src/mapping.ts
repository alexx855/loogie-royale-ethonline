import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Restart,
  Register,
  Move,
  NewCurseDrop,
  NewHealthDrop,
  Ticker,
} from "../generated/Game/Game";
import { WorldMatrix, Player, Game } from "../generated/schema";

export function handleRestart(event: Restart): void {
  let gameString = event.params.gameId.toString();
  let winner = event.params.winner;

  let prevGameString = event.params.prevGameId.toString()

  let prevGame = Game.load(prevGameString);

  if (prevGame !== null) {
      prevGame.winner = winner;
      prevGame.save();
    }

  let game = Game.load(gameString);
  if (game === null) {
    game = new Game(gameString);
  }

  game.ticker = BigInt.fromI32(0);
  game.tickerBlock = event.block.number;
  game.height = event.params.height;
  game.width = event.params.width;
  game.createdAt = event.block.timestamp;
  game.updatedAt = event.block.timestamp;

  // set to 0x0 
  game.winner = Bytes.fromHexString("0x0000000000000000000000000000000000000000");
  game.gameOn = false;
  game.curseDropCount = BigInt.fromI32(0);
  // predict next curse drop
  game.curseNextGameTicker = BigInt.fromI32(0).plus( event.params.curseInterval );
  game.curseInterval = event.params.curseInterval;
  // game.curseNextGameTicker = BigInt.fromI32(10);
  // game.curseInterval = BigInt.fromI32(0);
  game.save();

  // reset world matrix
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

}

export function handleRegister(event: Register): void {
  let playerString = event.params.txOrigin.toHexString();
  let player = Player.load(playerString);

  if (player === null) {
    player = new Player(playerString);
  }
  // add initial player data
  player.x = event.params.x;
  player.y = event.params.y;
  player.loogieId = event.params.loogieId;
  // player.health = BigInt.fromI32(100);
  player.health = event.params.initialHealth;
  player.transactionHash = event.transaction.hash.toHex();
  player.ticker = BigInt.fromI32(0); 
  player.tickerBlock = event.block.number;
  player.createdAt = event.block.timestamp;
  player.updatedAt = event.block.timestamp;
  player.save();

  // update reference to player on world matrix
  const fieldId = event.params.x.toString() + "-" + event.params.y.toString();
  let field = WorldMatrix.load(fieldId);
  if (field !== null) {
    field.player = playerString;
    field.save();
  }
}

export function handleMove(event: Move): void {
  let playerString = event.params.txOrigin.toHexString();
  let player = Player.load(playerString);

  if (player !== null) {
    const oldX = player.x;
    const oldY = player.y;

    // update player data
    player.health = event.params.health;
    player.x = event.params.x;
    player.y = event.params.y;
    player.ticker = event.params.gameTicker;
    player.tickerBlock = event.block.number;
    player.updatedAt = event.block.timestamp;
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
        field.save();
      }
    }
  }
}

export function handleNewHealthDrop(event: NewHealthDrop): void {

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
  // makes cursed the external borders/rigs/fields for curseDropCount index on the world 
  const cursePositions = event.params.cursePositions;

  const curseDropCount = event.params.curseDropCount;
  const curseNextGameTicker = event.params.curseNextGameTicker;

  const gameString = event.params.gameId.toString();

  const game = Game.load(gameString);
  if (game !== null) {
    game.curseNextGameTicker = curseNextGameTicker;
    game.curseDropCount = curseDropCount;
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

export function handleTicker(event: Ticker): void {
  const gameTicker = event.params.gameTicker;
  const gameOn = event.params.gameOn;
  const gameString = event.params.gameId.toString();
  const game = Game.load(gameString);
  if (game !== null) {
    game.ticker = gameTicker;
    game.tickerBlock = event.block.number;
    game.updatedAt = event.block.timestamp;
    game.gameOn = gameOn;
    game.save();
  }

}
