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
  let winner = event.params.winner.toString();

  if (winner !== "0x0000000000000000000000000000000000000000") {
    // Update winner on prev game
    let prevGameString = event.params.gameId
      .minus(BigInt.fromI32(1))
      .toString();
    // let prevGame = Game.load(prevGameString);
    // if (prevGame) {
    //   prevGame.winner = Address.fromString(winner);
    //   prevGame.save();
    //   // set no winner on new game
    //   winner = "0x0000000000000000000000000000000000000000";
    // }
  }

  let game = Game.load(gameString);
  if (game === null) {
    game = new Game(gameString);
  }

  game.gameId = event.params.gameId;
  game.height = event.params.height;
  game.width = event.params.width;
  game.createdAt = event.block.timestamp;
  game.restart = event.block.number;
  game.winner = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  // game.winner = Bytes.fromHexString(winner);
  game.curseNextGameTicker = BigInt.fromI32(10);
  game.gameOn = false;
  game.curseDropCount = BigInt.fromI32(0);
  game.curseInterval = BigInt.fromI32(0);
  game.ticker = BigInt.fromI32(0);
  // predict next curse drop
  // game.curseNextGameTicker = BigInt.fromI32(0).plus( event.params.curseInterval );
  // game.curseInterval = event.params.curseInterval;
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
  // player.health = event.params.initialHealth;
  player.x = event.params.x;
  player.y = event.params.y;
  player.createdAt = event.block.timestamp;
  player.transactionHash = event.transaction.hash.toHex();
  // set to 0 bc game did not start yet
  player.lastActionTick = BigInt.fromI32(0); 
  player.lastActionBlock = BigInt.fromI32(0);
  player.lastActionTime = BigInt.fromI32(0);
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
    // game.updatedAt = event.block.timestamp;
    game.ticker = gameTicker;
    game.gameOn = gameOn;
    game.save();
  }

}
