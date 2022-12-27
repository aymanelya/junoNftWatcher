require('dotenv').config();
const WebSocket=require('ws');
const axios = require('axios');
const { createHash } = require('crypto');
const {decodeTxRaw, Registry} = require('@cosmjs/proto-signing');
const { defaultRegistryTypes ,SigningStargateClient} = require("@cosmjs/stargate");
const {cosmwasm} = require("osmojs");
const mysql = require('mysql');

// const con = mysql.createConnection({
//   host: process.env.DBHost,
//   user: process.env.DBUser,
//   password: process.env.DBPass,
//   database: process.env.DBDatabase
// });

// con.connect();






const ws = new WebSocket(process.env.nodeWS);

const registry = new Registry([
    ...defaultRegistryTypes,
    ['/cosmwasm.wasm.v1.MsgExecuteContract',cosmwasm.wasm.v1.MsgExecuteContract],
]);




// ###################  WEBSOCKET EVENTS ###################

ws.on('open', function open() {
    console.log('Connected on Osmosis blockchain from WebSocket');
    ws.send(JSON.stringify({
      "method":"subscribe",
      "params": ["tm.event='NewBlock'"],
      "id":"1",
      "jsonrpc":"2.0"
    }));
});
ws.on('close', function close() {
    console.error('connection disconnected from Osmosis WebSocket');
});




let currentBlock;

ws.on('message', async function incoming(data) {



    const message = JSON.parse(data.toString('utf-8'));
    if(message.result.data){
    
      if(message.result.query=="tm.event='NewBlock'"){
        currentBlock = parseInt(message.result.data.value.block.header.height)
        let txs = message.result.data.value.block.data.txs
        console.log(`------------------------- NEW BLOCK ${currentBlock} (${txs.length} txs) -------------------------------`);

        // txs=txs.filter((tx,i)=>i<1)
        

        txs = txs.map((tx)=>{
            const decodedBase64 = Uint8Array.from(Buffer.from(tx, 'base64'))

            const decodedTx = decodeTxRaw(decodedBase64)
            const txHash = createHash('sha256').update(decodedBase64).digest('hex')

            decodedTx.body.messages.forEach((msg)=>{
                if(msg.typeUrl == "/cosmwasm.wasm.v1.MsgExecuteContract"){
                    let decodedMsg = registry.decode(msg);
                    decodedMsg.msg = JSON.parse(String.fromCharCode(...decodedMsg.msg))
                    console.log("msg",txHash,JSON.stringify(decodedMsg))
                    // console.log("type",typeof(decodedMsg.msg),decodedMsg.msg)
                }
            })
            // console.log(decodedTx.body.messages)
            // console.log(decodedTx)
        })


        // const originalTxs = txs
     
        // txs = txs.map(async(tx)=>{
        //     const decodedBase64 = Uint8Array.from(Buffer.from(tx, 'base64'))
        //     const decodedTx = decodeTxRaw(decodedBase64)
        //     const txHash = createHash('sha256').update(decodedBase64).digest('hex')
        //     let response = await signingClient.getTx(txHash);
        //     // console.log(JSON.stringify(decodedTx),txHash)
        //     if(response.code!=0) return //If transaction failed

        //     const events = JSON.parse(response.rawLog)[0].events
        //     let swaps = events.filter((event)=>event.type == "token_swapped")
        //     if(swaps.length==0) return
        //     swaps = swaps[0]

        //     const walletAddress = swaps.attributes.filter((att)=>att.key=="sender")[0].value
        //     const pools = JSON.stringify(swaps.attributes.filter((att)=>att.key=="pool_id").map((pool)=>pool.value))
        //     const txTokenInAmount = parseInt(swaps.attributes.filter((att)=>att.key=="tokens_in")[0].value.match(/(\d+)/)[1])
        //     const txTokenIn = swaps.attributes.filter((att)=>att.key=="tokens_in")[0].value.replace(txTokenInAmount,"")
        //     const txTokenOutAmount = parseInt(swaps.attributes.filter((att)=>att.key=="tokens_out").pop().value.match(/(\d+)/)[1])
        //     const txTokenOut = swaps.attributes.filter((att)=>att.key=="tokens_out").pop().value.replace(txTokenOutAmount,"")

        //     if(txTokenIn!=txTokenOut) return

        //     const txFees = parseInt(decodedTx.authInfo.fee.amount[0].amount)
        //     const now = (new Date()).toJSON()
        //     console.log({block:currentBlock,datetime:now,txHash,txTokenIn,txTokenOut,txTokenInAmount,txTokenOutAmount,txFees,pools,walletAddress})
        //     const sql = `INSERT INTO arbitrageTxs (block, datetime, txHash,txTokenIn,txTokenOut,txTokenInAmount,txTokenOutAmount,txFees,pools,wallet) VALUES (${currentBlock}, '${now}', '${txHash}', '${txTokenIn}', '${txTokenOut}',${txTokenInAmount},${txTokenOutAmount},${txFees},'${pools}','${walletAddress}')`;
        //       con.query(sql, function (err, result) {
        //         if (err) throw err;
        //         console.log("1 record inserted");
        //     });


        //     return

            
        //     // if(decodedTx.body.messages.length > 1) return 
            
        //     // const msg = decodedTx.body.messages[0]
            
        //     // if(!msg.typeUrl.includes("SwapExactAmountIn")) return
        //     const decodedMsg = registry.decode(msg);
        //     const wallet = decodedMsg.sender
        //     // const swapData = {
        //     //   tokenIn: decodedMsg.tokenIn.denom,
        //     //   amountIn: decodedMsg.tokenIn.amount,
        //     //   swaps: decodedMsg.routes.map((swap)=>{return {poolId:swap.poolId.low.toString(), tokenOut:swap.tokenOutDenom}})
        //     // }
        //     // // if(!swapData.swaps.every((element)=>pairIdsHashes.hasOwnProperty(element.poolId) && poolHashes.includes(pairIdsHashes[element.poolId]))) return
        //     // // if(swapData.swaps[swapData.swaps.length-1].tokenOut == swapData.tokenIn) return
        //     // console.log(txHash,response.code)
        //     return {txHash,txStatus:response.code,wallet,swapData}
        // })
        // await Promise.all(txs)
        // // console.table(txs)
        // txs = txs.filter((tx)=>tx)

        // // const toSave = {block,reserves,originalTxs,decodedTxs: txs}
        // const toSave = {block:currentBlock,reserves,decodedTxs: txs}
        

        // // fs.appendFile('logs.txt', JSON.stringify(toSave).concat(",\n"), function (err) {
        // //     if (err) throw err;
        // //   });

      }
      else{
        console.log("unknown event",message.result.query);
      }
  
    }
  });


// ###################  BASIC FUNCTIONS ###################

// async function updateReserves(){
//     let pairReserves={}
//       try {
//           const pools = await axios.get(`${process.env.nodeLCD}/osmosis/gamm/v1beta1/pools?pagination.limit=50000`)
//           pools.data.pools.forEach((pair)=>{
//             if(poolHashes.includes(pair.address)) {            
//               pairReserves[pair.address] = {
//                 pairAddress: pair.address,
//                 id: pair.id,
//                 token0: pair.pool_assets[0].token.denom,
//                 token1: pair.pool_assets[1].token.denom,
//                 reserve0: pair.pool_assets[0].token.amount,
//                 reserve1: pair.pool_assets[1].token.amount,
//                 decimals0: decimals[pair.pool_assets[0].token.denom],
//                 decimals1: decimals[pair.pool_assets[1].token.denom],
//                 swapFees: (10000-10000*parseFloat(pair.pool_params.swap_fee))/10000,
//                 weight0: parseInt(pair.pool_assets[0].weight),
//                 weight1: parseInt(pair.pool_assets[1].weight)
//               }
//             }
//           })
//           return pairReserves
//       } catch (error) {
//           console.error(error)
//       }
//   }
