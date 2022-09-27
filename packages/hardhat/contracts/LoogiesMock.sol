pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

import "./HexStrings.sol";
import "./ToColor.sol";

contract Loogies is ERC721Enumerable, Ownable {
    using Strings for uint256;
    using HexStrings for uint160;
    using ToColor for bytes3;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // TODO: allow owner to change recipient
    address payable public constant recipient =
        payable(0x94ca0F69A3E9dDffe090E59Bac5186ddE97B5820);

    // TODO: allow admin to change the price, to match the min of ramp, it should be enough to cover gas for a game
    uint256 public price = 0.0012 ether;

    mapping(uint256 => bytes3) public color;
    mapping(uint256 => uint256) public chubbiness;
    mapping(uint256 => uint256) public mouthLength;

    constructor() ERC721("PLoogies", "PLOOG") {
        // RELEASE THE  LOOGIES!
    }

    function mintItem() public payable returns (uint256) {
        require(msg.value >= price, "NOT ENOUGH");

        _tokenIds.increment();

        uint256 id = _tokenIds.current();
        _mint(msg.sender, id);

        bytes32 predictableRandom = keccak256(
            abi.encodePacked(
                id,
                blockhash(block.number - 1),
                msg.sender,
                address(this)
            )
        );
        color[id] =
            bytes2(predictableRandom[0]) |
            (bytes2(predictableRandom[1]) >> 8) |
            (bytes3(predictableRandom[2]) >> 16);
        chubbiness[id] =
            35 +
            ((55 * uint256(uint8(predictableRandom[3]))) / 255);
        // small chubiness loogies have small mouth
        mouthLength[id] =
            180 +
            ((uint256(chubbiness[id] / 4) *
                uint256(uint8(predictableRandom[4]))) / 255);

        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "could not send");

        return id;
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        require(_exists(id), "not exist");
        string memory name = string(
            abi.encodePacked("Loogie #", id.toString())
        );
        string memory description = string(
            abi.encodePacked(
                "This Loogie is the color #",
                color[id].toColor(),
                " with a chubbiness of ",
                uint2str(chubbiness[id]),
                " and mouth length of ",
                uint2str(mouthLength[id]),
                "!!!"
            )
        );
        string memory image = Base64.encode(bytes(generateSVGofTokenById(id)));

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes.concat(
                            abi.encodePacked(
                                '{"name":"',
                                name,
                                '", "description":"',
                                description,
                                '", "external_url":"https://burnyboys.com/token/',
                                id.toString(),
                                '", "attributes": [{"trait_type": "color", "value": "#',
                                color[id].toColor(),
                                '"},{"trait_type": "chubbiness", "value": '
                            ),
                            abi.encodePacked(
                                uint2str(chubbiness[id]),
                                '},{"trait_type": "mouthLength", "value": ',
                                uint2str(mouthLength[id]),
                                '}], "owner":"',
                                (uint160(ownerOf(id))).toHexString(20),
                                '", "image": "',
                                "data:image/svg+xml;base64,",
                                image,
                                '"}'
                            )
                        )
                    )
                )
            );
    }

    function generateSVGofTokenById(uint256 id)
        internal
        view
        returns (string memory)
    {
        string memory svg = string(
            abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
                renderTokenById(id),
                renderCrown(),
                "</svg>"
            )
        );

        return svg;
    }

    function renderCrown() public pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '<g class="crown" transform="translate(140,0) scale(5,5)">',
                    '<path fill="#f9c605"  d="M3 16l-3-10 7.104 4 4.896-8 4.896 8 7.104-4-3 10h-18zm0 2v4h18v-4h-18z"/>',
                    "</g>"
                )
            );
    }

    // function renderSwordById() public view returns (string memory) {
    //     return
    //         string(
    //             abi.encodePacked(
    //                 '<g class="sword" transform="translate(-550,-270) scale(2.8,2.8) rotate(-10)">',
    //                 '<path fill="#f9c605" stroke="#000" stroke-width="1" d="M254.5 224.83h-1.4v11.7h2c1.7 0 3.2 1.1 3.7 2.7h-4v33.5c0 .2-.1.3-.2.4l-4.5 4.8c-.2.2-.5.2-.7 0l-4.5-4.8c-.1-.1-.1-.2-.1-.4v-33.5h-3.6c.5-1.5 2-2.7 3.7-2.6h2v-11.7h-1.4c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5h9c.8 0 1.5.7 1.5 1.5 0 .7-.7 1.4-1.5 1.4z" />',
    //                 "</g>"
    //             )
    //         );
    // }

    // Visibility is `public` to enable it being called by other contracts for composition.
    function renderTokenById(uint256 id) public view returns (string memory) {
        // the translate function for the mouth is based on the curve y = 810/11 - 9x/11
        string memory render = string(
            bytes.concat(
                abi.encodePacked(
                    '<g id="eye1">',
                    '<ellipse stroke-width="3" ry="29.5" rx="29.5" id="svg_1" cy="154.5" cx="181.5" stroke="#000" fill="#fff"/>',
                    '<ellipse ry="3.5" rx="2.5" id="svg_3" cy="154.5" cx="173.5" stroke-width="3" stroke="#000" fill="#000000"/>',
                    "</g>",
                    '<g id="head">',
                    '<ellipse fill="#',
                    color[id].toColor(),
                    '" stroke-width="3" cx="204.5" cy="211.80065" id="svg_5" rx="',
                    chubbiness[id].toString(),
                    '" ry="51.80065" stroke="#000"/>',
                    "</g>"
                ),
                abi.encodePacked(
                    '<g id="eye2">',
                    '<ellipse stroke-width="3" ry="29.5" rx="29.5" id="svg_2" cy="168.5" cx="209.5" stroke="#000" fill="#fff"/>',
                    '<ellipse ry="3.5" rx="3" id="svg_4" cy="169.5" cx="208" stroke-width="3" fill="#000000" stroke="#000"/>',
                    "</g>"
                    '<g class="mouth" transform="translate(',
                    uint256((810 - 9 * chubbiness[id]) / 11).toString(),
                    ',0)">',
                    '<path d="M 130 240 Q 165 250 ',
                    mouthLength[id].toString(),
                    ' 235" stroke="black" stroke-width="3" fill="transparent"/>',
                    "</g>"
                )
            )
        );

        return render;
    }

    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
