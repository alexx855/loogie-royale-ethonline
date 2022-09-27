// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

enum MoveDirection {
    Up,
    Down,
    Left,
    Right
}

// abstract contract LoogieCoinContract {
//   function mint(address to, uint256 amount) virtual public;
// }

abstract contract LoogiesContract {
    function tokenURI(uint256 id) external view virtual returns (string memory);

    function ownerOf(uint256 id) external view virtual returns (address);
}

contract Game is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _gameIds;
    Counters.Counter private _gameTicker;
    Counters.Counter private _curseDropCount;

    event Restart(
        uint256 gameId,
        uint8 width,
        uint8 height,
        uint256 curseInterval,
        address winner
    );
    event Register(
        address indexed txOrigin,
        address indexed msgSender,
        uint256 gameId,
        uint8 x,
        uint8 y,
        uint256 loogieId,
        uint256 initialHealth
    );
    // TODO: this
    // event Unregister(
    //     address indexed txOrigin,
    //     address indexed msgSender,
    //     uint256 loogieId
    // );
    event Ticker(uint256 gameId, address indexed txOrigin, bool gameOn, uint256 gameTicker);
    event Move(
        uint256 gameId,
        address indexed txOrigin,
        uint8 x,
        uint8 y,
        uint256 health,
        uint256 gameTicker
    );
    event NewCurseDrop(
        uint256 gameId,
        Position[] cursePositions,
        uint256 curseDropCount,
        uint256 curseNextGameTicker
    );
    event NewHealthDrop(
        uint256 gameId,
        uint256 amount,
        uint8 dropX,
        uint8 dropY
    );

    struct Field {
        address player;
        bool cursed;
        uint256 healthAmountToCollect;
    }

    struct Position {
        uint8 x;
        uint8 y;
    }

    LoogiesContract public loogiesContract;

    // true = playing or game over when we have a gameRewards for the current gameId != address(0)
    // false = witing for players,
    bool public gameOn = false;
    // counters
    uint256 public gameTicker = _gameTicker.current();
    uint256 public gameId = _gameIds.current();
    uint256 public curseDropCount = _curseDropCount.current();
    // game settings
    bool public dropOnCollect = true;
    uint256 public actionInterval = 10; // 10 secs, block.timestamp is in UNIX seconds
    uint8 public attritionDivider = 10;
    uint8 public curseInterval = 10;
    uint8 public constant curseDropMax =
        (width / 2) % 1 == 0 ? width / 2 : width / 2 + 1;
    uint8 public constant width = 7;
    uint8 public constant height = 7;

    Position public centerPosition;
    Position[4] public spawnPoints;

    // game state storage
    Field[width][height] public worldMatrix;

    mapping(uint256 => Position[]) public worldMatrixRings;
    mapping(address => Position) public yourPosition;
    mapping(address => uint256) public health;
    mapping(address => address) public yourContract;
    mapping(uint256 => address) public gameRewards;
    mapping(address => uint256) public lastActionTick;
    mapping(address => uint256) public lastActionTime;
    mapping(address => uint256) public lastActionBlock;
    mapping(address => uint256) public loogies;
    address[] public players;
    uint256 public restartBlockNumber;
    uint256 public tickerBlock;

    constructor(address _loogiesContractAddress) {
        loogiesContract = LoogiesContract(_loogiesContractAddress);

        // set spawn points
        for (uint8 i = 0; i < 4; i++) {
            spawnPoints[i].x = i % 2 == 0 ? 0 : width - 1;
            spawnPoints[i].y = i < 2 ? 0 : height - 1;
        }

        // set center position
        centerPosition = Position(
            ((width / 2) % 1 == 0 ? width / 2 : width / 2 + 1),
            ((height / 2) % 1 == 0 ? height / 2 : height / 2 + 1)
        );

        setWorldMatrixRings();

        // start the game
        restart(address(0));
    }

    function setWorldMatrixRings() internal {
        for (uint8 i = 0; i < curseDropMax; i++) {
            bool ix = true;
            bool iy = false;
            bool dy = false;
            bool dx = false;
            // ring lenght, equal to the sum of all field in ring
            uint8 y = i;
            uint8 x = i;
            uint8 side = 0;
            // total field in ring
            uint8 fields = (width - 1 - i) * 4 - (i * 4);
            for (uint8 j = 0; j < fields; j++) {
                // set fields into the 4 sides of the matrix for i-th ring
                // uint8 side = j != 0 ? j % (width - i) : 1;
                uint8 corner = j % (fields / 4);

                // console.log("%s %s %s", x, y, j);
                // console.log("i %s corner %s", i, corner);
                // console.log("dx %s dy %s", dx, dy);

                if (corner == 0) {
                    // x = i;
                    // y = i;

                    if (side == 1) {
                        iy = true;
                        ix = false;
                    } else if (side == 2) {
                        iy = false;
                        dx = true;
                    } else if (side == 3) {
                        dx = false;
                        dy = true;
                    } else if (side == 4) {
                        dy = false;
                        ix = true;
                    }

                    side++;
                }

                worldMatrixRings[i].push(Position(x, y));

                if (ix) {
                    x++;
                }

                if (iy) {
                    y++;
                }

                if (dx) {
                    x--;
                }

                if (dy) {
                    y--;
                }
            }
            // console.log("--");
        }
    }

    function setDropOnCollect(bool _dropOnCollect) public onlyOwner {
        dropOnCollect = _dropOnCollect;
    }

    // restart everything, starts a new game and wait for players to join the new game
    // TODO: make internal
    function restart(address winner) public {
        require(
            gameOn == false || (gameOn == true && gameRewards[gameId] != address(0)),
            "Game is still running"
        );
        // enabled players queue
        gameOn = false;
        // current game id
        // uint256 prevGameId = _gameIds.current();

        // set new game id
        _gameIds.increment();
        gameId = _gameIds.current();

        // reset game ticker
        _gameTicker.reset();
        gameTicker = _gameTicker.current();
        tickerBlock = block.number;

        // reset curse drop counter
        _curseDropCount.reset();
        curseDropCount = _curseDropCount.current();

        // save restart block number
        restartBlockNumber = block.number;

        // reset world matrix
        for (uint256 i = 0; i < players.length; i++) {
            yourContract[players[i]] = address(0);
            Position memory playerPosition = yourPosition[players[i]];
            worldMatrix[playerPosition.x][playerPosition.y] = Field(
                address(0),
                false,
                0
            );
            yourPosition[players[i]] = Position(0, 0);
            health[players[i]] = 0;
            lastActionTick[players[i]] = 0;
            lastActionTime[players[i]] = 0;
            lastActionBlock[players[i]] = 0;
            loogies[players[i]] = 0;
        }

        delete players;

        emit Restart(gameId, width, height, curseInterval, winner);
        console.log("Restarted game %s", gameId);
    }

    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }

    function getWorldMatrixRingsCount(uint8 ringIndex)
        public
        view
        returns (uint256)
    {
        return worldMatrixRings[ringIndex].length;
    }

    function getWorldMatrixRingsByIndeAtPositions(
        uint8 ringIndex,
        uint256 index
    ) public view returns (Position memory) {
        return worldMatrixRings[ringIndex][index];
    }

    function getWorldMatrixRingsByIndex(uint8 ringIndex)
        public
        view
        returns (Position[] memory)
    {
        return worldMatrixRings[ringIndex];
    }

    function update(address newAddress) public {
        require(gameOn, "update NOT PLAYING");
        require(tx.origin == msg.sender, "MUST BE AN EOA");
        // require(yourContract[tx.origin] != address(0), "MUST HAVE A CONTRACT");
        health[tx.origin] = (health[tx.origin] * 80) / 100; //20% loss of health on contract update?!!? lol
        yourContract[tx.origin] = newAddress;
    }

    // function unregister(uint256 loogieId) public {
    //     require(gameOn != true, "TOO LATE, GAME IS ALREADY STARTED");
    //     // require(yourContract[tx.origin] !== address(0), "Not registered");
    //     // require(yourContract[tx.origin] == msg.sender, "Not registered");
    //     require(
    //         loogiesContract.ownerOf(loogieId) == tx.origin,
    //         "ONLY LOOGIES THAT YOU OWN"
    //     );

    //     // players.push(tx.origin);

    //     // yourContract[tx.origin] = msg.sender;

    //     // health[tx.origin] = 100;

    //     // loogies[tx.origin] = loogieId;

    //     // delete player from position
    //     // yourPosition[tx.origin]

    //     // delete player on the worldmatrix
    //     delete worldMatrix[playerPosition.x][playerPosition.y].player;

    //     emit Unregister(
    //         tx.origin,
    //         msg.sender,
    //         loogieId,
    //         gameOn
    //     );

    // }

    // player register a loogie and try to join the active game
    function register(uint256 loogieId) public {
        require(gameOn != true, "TOO LATE, GAME IS ALREADY STARTED");
        require(yourContract[tx.origin] == address(0), "Already registered");
        require(
            loogiesContract.ownerOf(loogieId) == tx.origin,
            "ONLY LOOGIES THAT YOU OWN"
        );
        require(players.length <= 3, "MAX 4 LOOGIES REACHED");

        players.push(tx.origin);
        yourContract[tx.origin] = msg.sender;
        health[tx.origin] = 101;
        loogies[tx.origin] = loogieId;

        // set initial player position
        Position memory playerPosition = Position(
            spawnPoints[players.length - 1].x,
            spawnPoints[players.length - 1].y
        );
        yourPosition[tx.origin] = playerPosition;

        // Place player on the worldmatrix
        worldMatrix[playerPosition.x][playerPosition.y].player = tx.origin;

        uint256 currentGameId = _gameIds.current();

        emit Register(
            tx.origin,
            msg.sender,
            currentGameId,
            playerPosition.x,
            playerPosition.y,
            loogieId,
            health[tx.origin]
        );

        // drop initial health, add feature flag?
        // if (gameOn) {
        dropHealth(50);
        // }

        // check if all players are registered, if so start the game
        if (players.length == 4) {
            gameOn = true;
            runTicker();
        }

    }

    function currentPosition() public view returns (Position memory) {
        return yourPosition[tx.origin];
    }

    function isCursedByPlayer(address player) public view returns (bool) {
        return
            worldMatrix[yourPosition[player].x][yourPosition[player].y].cursed;
    }

    function isCursed(uint8 x, uint8 y) public view returns (bool) {
        return worldMatrix[x][y].cursed;
    }

    function helathAmmount(uint8 x, uint8 y) public view returns (uint256) {
        return worldMatrix[x][y].healthAmountToCollect;
    }

    function positionOf(address player) public view returns (Position memory) {
        return yourPosition[player];
    }

    function tokenURIOf(address player) public view returns (string memory) {
        // require(yourContract[player] != address(0), "Must have a contract");
        // require(loogies[player] != 0, "Must have a loogie");

        // TODO: if loogie is dead add gray filter to the svg, or Xs on the eyes could be cool

        // TODO: move sword amd crowns here or to custom nfts and transfer to the player
        return loogiesContract.tokenURI(loogies[player]);
    }

    // function collectHealth(uint8 x, uint8 y) internal {
    // require(health[tx.origin] > 0, "YOU DED");
    // }

    function setAttritionDivider(uint8 newDivider) public onlyOwner {
        attritionDivider = newDivider;
    }

    function gameEnded() public view returns (bool) {
        uint256 currentGameId = _gameIds.current();
        return gameRewards[currentGameId] == address(0);
    }

    function move(uint8 x, uint8 y) public {
        require(gameOn, "move NOT PLAYING");

        uint256 currentGameId = _gameIds.current();
        require(gameRewards[currentGameId] == address(0), "GAME ENDED");

        require(health[tx.origin] > 0, "YOU ARE DEAD");

        require(
            health[tx.origin] > attritionDivider,
            "NOT ENOUGH HEALTH TO MOVE"
        );

        require(x < width && y < height, "OUT OF BOUNDS");

        // check if player is on a cursed field
        Position memory position = yourPosition[tx.origin];
        require(
            worldMatrix[position.x][position.y].cursed == false,
            "PLAYER ON CURSED POSITION, CANT MOVE"
        );

        // check if its not the same place as before
        require(position.x != x || position.y != y, "SAME POSITION AS BEFORE");
      
        // check if its moving too far, max 2 squares
        require(position.x + 2 >= x && position.x - 2 <= x, "TOO FAR X");
        require(position.y + 2 >= y && position.y - 2 <= y, "TOO FAR Y");

        // prevent multiples moves
        // require(
        //     block.timestamp - lastActionTime[tx.origin] >= actionInterval,
        //     "TOO EARLY TIME, WAIT A FEW SECS AND TRY AGAIN"
        // );

        // require(gameTicker > lastActionTick[tx.origin], "TOO EARLY TICKER");

        // check if there is a dead player on the field
        Field memory field = worldMatrix[x][y];
        require(
            field.player == address(0) ||
                (field.player != address(0) && health[field.player] > 0),
            "A DEAD LOOGIE ON THIS POSITION, CANT MOVE HERE"
        );

        // check if field is cursed
        require(field.cursed == false, "CURSED POSITION, CANT MOVE HERE");

        // reduce health when players move
        // TODO: create feature flag for this
        // health[tx.origin] -= attritionDivider;
        // if (health[tx.origin] < 0) {
        //     health[tx.origin] = 0;
        // }

        // handle custom game logic like cursed drops, health drops, etc
        runTicker();

        // check if there is no players on the field
        if (field.player == address(0)) {
            console.log("NO PLAYER ON THE FIELD");
            // move to the new position
            worldMatrix[position.x][position.y].player = address(0);
            worldMatrix[x][y].player = tx.origin;
            yourPosition[tx.origin] = Position(x, y);

            // collect health if there is any
            if (field.healthAmountToCollect > 0) {
                console.log("COLLECTING HEALTH");
                // Position memory position = yourPosition[tx.origin];
                // require(field.healthAmountToCollect > 0, "NOTHING TO COLLECT");

                // increase health
                uint256 amount = field.healthAmountToCollect;
                health[tx.origin] += amount;
                worldMatrix[x][y].healthAmountToCollect = 0;
                console.log("COLLECTED %s HEALTH", amount);

                if (dropOnCollect) {
                    // dropHealth(amount);
                    dropHealth(100);
                }
            }

            emit Move(
                currentGameId,
                tx.origin,
                x,
                y,
                health[tx.origin],
                gameTicker
            );
        } else {
            console.log("PLAYER ON THE FIELD");
            // keep loogies on the same field place and fight!
            // the winner steals 50% of the loser health
            // with the same health amount, the player caller tx.origin wins
            if (health[tx.origin] >= health[field.player]) {
                health[tx.origin] += health[field.player] / 2;
                health[field.player] = 0;
            } else {
                // field.player wins
                health[field.player] += health[tx.origin] / 2;
                health[tx.origin] = 0;
            }

            // emmit the fight move event for the player on this field
            emit Move(
                currentGameId,
                field.player,
                x,
                y,
                health[field.player],
                gameTicker
            );

            // emmit the fight move event for the player caller tx.origin
            emit Move(
                currentGameId,
                tx.origin,
                position.x,
                position.y,
                health[tx.origin],
                gameTicker
            );
        }

    }

    function needsManualTicker() public view returns (bool) {
        // require(gameOn, "NOT PLAYING");
        console.log("block.number", block.number);
        console.log("curseInterval", curseInterval);
        console.log("gameTicker", gameTicker);
        console.log("tickerBlock", tickerBlock);


        // return block.number + curseInterval > tickerBlock;
        return tickerBlock < block.number;
    }

    // TODO: change to internal
    function dropHealth(uint256 amount) public {
        bytes32 predictableRandom = keccak256(
            abi.encodePacked(
                blockhash(block.number - 1),
                msg.sender,
                // tx.origin,
                address(this)
            )
        );

        uint8 index = 0;
        uint8 x = uint8(predictableRandom[index++]) % width;
        uint8 y = uint8(predictableRandom[index++]) % height;

        Field memory field = worldMatrix[x][y];

        while (field.player != address(0) || field.healthAmountToCollect > 0) {
            x = uint8(predictableRandom[index++]) % width;
            y = uint8(predictableRandom[index++]) % height;
            field = worldMatrix[x][y];
        }

        field.healthAmountToCollect = amount;

        uint256 currentGameId = _gameIds.current();

        console.log("DROPPED %s HEALTH", amount);
        console.log("DROPPED AT %s, %s", x, y);

        emit NewHealthDrop(
            currentGameId,
            amount,
            x,
            y
            // prev drop position
            // oldX,
            // oldY
        );
    }

    function runTicker() public {
        console.log("RUNNING GAME TICKER");
        require(gameOn, "NOT PLAYING");
        uint256 currentGameId = _gameIds.current();

        if (gameOn == true && gameRewards[currentGameId] != address(0)) {
            console.log("GAME OVER, RESTARTING");
            restart(gameRewards[currentGameId]);
        } else {
            // check if game is NOT over by checking players health and cursed positions
            address winner = address(0);
            uint8 playersAlive = 0;
            for (uint256 i = 0; i < players.length; i++) {
                Position memory playerPosition = yourPosition[players[i]];
                console.log(
                    "-- PLAYER: %s POSITION: %s  %s",
                    players[i],
                    playerPosition.x,
                    playerPosition.y
                );

                console.log(
                    "HEALTH: %s CURSED: %s ",
                    health[players[i]],
                    worldMatrix[playerPosition.x][playerPosition.y].cursed
                );

                if (
                    health[players[i]] > 0 &&
                    worldMatrix[playerPosition.x][playerPosition.y].cursed ==
                    false
                ) {
                    // player is alive and not cursed, continue
                    playersAlive++;
                    winner = players[i];
                    // continue;
                }
            }

            if (playersAlive == 0) {
                console.log("ALL PLAYERS ARE DEAD, GAME OVER");
                // all players are dead, restart the game, save the winner address using the contract address
                gameRewards[currentGameId] = address(this);
                // emmit game over event
            } else if (playersAlive == 1 && winner != address(0)) {
                console.log("WE HAVE A WINNER %s, GAME OVER", winner);
                gameRewards[currentGameId] = winner;
                // TODO: add mint and add SVG crown to loogie loogies[winner]
                // gameOn = false;
            } else {
                console.log("GAME IS STILL ON");

                // check if we need to drop a curse
                if (gameTicker > 0 && gameTicker % curseInterval == 0) {
                    dropCurse();
                }
            }

            // increment  ticker
            _gameTicker.increment();
            gameTicker = _gameTicker.current();
            tickerBlock = block.number;
            lastActionTick[tx.origin] = gameTicker;
            lastActionTime[tx.origin] = block.timestamp;
            lastActionBlock[tx.origin] = block.number;
            console.log("GAME TICKER: %s", gameTicker);
            console.log("GAME LAST ACTION TICK: %s", lastActionTick[tx.origin]);
            console.log("GAME LAST ACTION TIME: %s", lastActionTime[tx.origin]);
            console.log(
                "GAME LAST ACTION BLOCK: %s",
                lastActionBlock[tx.origin]
            );
        }

        console.log("GAME TICKER END");
        emit Ticker( currentGameId, tx.origin, gameOn, gameTicker );
    }
   
    function totalPlayers() public view returns (uint256) {
        return players.length;
    }

    function getWinner() public view returns (address) {
        return gameRewards[_gameIds.current()];
    }

    function isOver() public view returns (bool) {
        return gameRewards[_gameIds.current()] != address(0);
    }

    function dropCurse() public {
        require(gameOn, "dropCurse NOT PLAYING");
        // uint256 curseDropCount = _curseDropCount.current();
        require(curseDropCount < curseDropMax, "TOO MANY CURSE DROPS");

        console.log(
            "curseDropMax %s curseDropCount %s",
            curseDropMax,
            curseDropCount
        );

        for (uint8 i = 0; i < worldMatrixRings[curseDropCount].length; i++) {
            uint8 x = worldMatrixRings[curseDropCount][i].x;
            uint8 y = worldMatrixRings[curseDropCount][i].y;
            console.log("CURSE DROPPED ON %s,%s RING %s", x, y, curseDropCount);

            // check for player, if so kill player and drop his health
            Field memory field = worldMatrix[x][y];
            worldMatrix[x][y] = Field(field.player, true, 0);

            if (field.player != address(0) && health[field.player] > 0) {
                console.log("CURSE DROPPED ON PLAYER %s", field.player);
                health[field.player] = 0;
                // emit Move(
                //     field.player,
                //     x,
                //     y,
                //     health[field.player],
                //     gameTicker
                // );
            }
        }

        uint256 currentGameId = _gameIds.current();

        uint256 curseNextGameTicker = gameTicker + curseInterval;

        emit NewCurseDrop(
            currentGameId,
            worldMatrixRings[curseDropCount],
            curseDropCount,
            curseNextGameTicker
        );

        // increment after event to start at worldMatrixRings[] 0 index
        _curseDropCount.increment();
    }
}
