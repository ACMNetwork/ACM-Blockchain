const crypto = require('crypto');
import sha256 from "crypto-js/sha256";

function computeStateChange(stateJson: object,transactions: object,environ: object): object{
	if(typeof stateJson != "object"){
		return undefined; // Fail to compute
	}
	if(typeof stateJson["user"] != "object"){
		return undefined; // Fail to compute
	}
	let newStat = stateJson;
	let miner = environ["miner"];
	if(newStat["user"][miner] == undefined){
		return undefined; // Miner is not found
	}
	for(let tx of transactions){
		if(typeof tx != "object"){
			continue;
		}
		if(typeof tx["sender"] != "string" || typeof tx["operation"] != "string" || typeof tx["nonce"] != "number" || typeof tx["signature"] != "string"){
			continue; // tx error
		}
		if(tx["sender"] == "acm.system"){
			continue; // SYSTEM ACCOUNT CAN'T SEND TRANSACTION
		}
		const verify = crypto.createVerify('SHA256');
		verify.update(tx["sender"]+" SENDED AT "+tx["nonce"]+" TRANSACT "+tx["operation"]);
		verify.end();
		if(!verify.verify(newStat["user"][tx["sender"]]["pubkey"], tx["signature"])){
			continue; // signature error
		}
		if(tx["nonce"] != newStat["user"][tx["sender"]]["nonce"]){
			continue;
		}
		newStat["user"][tx["sender"]]++;
		let operation: object = JSON.parse(tx["operation"]);
		if(typeof operation != "object" || typeof operation["command"] != "string"){
			continue; // Operation is bad
		}
		// gas fee
		if(newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] == undefined){
			break; // insuffient
		}
		if(newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] < 192318){
			break; // insuffient
		}
		newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] -= 192318;
		if(newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] == undefined){
			newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] = 0;
		}
		newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] += 192318;
		// execution
		switch(operation["command"]){
			case "transfer":
				if(typeof operation["to"] != "string" || typeof operation["asset"] != "string" || typeof operation["value"] != "number"){
					break;
				}
				if(newStat["user"][tx["sender"]]["assets"][operation["asset"]] == undefined){
					break; // insuffient
				}
				if(newStat["user"][operation["to"]] == undefined){
					break;
				}
				if(newStat["user"][tx["sender"]]["assets"][operation["asset"]] < operation["value"]){
					break; // insuffient
				}
				newStat["user"][tx["sender"]]["assets"][operation["asset"]] -= operation["value"];
				if(newStat["user"][operation["to"]]["assets"][operation["asset"]] == undefined){
					newStat["user"][operation["to"]]["assets"][operation["asset"]] = 0;
				}
				newStat["user"][operation["to"]]["assets"][operation["asset"]] += operation["value"];
			break;
			case "createToken":
				if(typeof operation["name"] != "string" || typeof operation["symbol"] != "string" || typeof operation["metadata"] != "object"){
					break;
				}
				let assetID = sha256(sha256(tx["sender"]).toString()+":"+tx["nonce"]).toString();
				newStat["assets"][assetID] = {
					"name": operation["name"],
					"symbol": operation["symbol"],
					"metadata": operation["metadata"],
					"decimal":6,
					"owner":tx["sender"]
				};
			break;
			case "mintToken":
				if(typeof operation["value"] != "number" || typeof operation["to"] != "string" || typeof operation["asset"] != "string"){
					break;
				}
				if(newStat["assets"][operation["asset"]]["owner"] != tx["sender"]){
					break;
				}
				if(newStat["user"][operation["to"]] == undefined){
					break;
				}
				if(newStat["user"][operation["to"]]["assets"][operation["asset"]] == undefined){
					newStat["user"][operation["to"]]["assets"][operation["asset"]] = 0;
				}
				newStat["user"][operation["to"]]["assets"][operation["asset"]] += operation["value"];
			break;
			case "transferTokenOwner":
				if(typeof operation["to"] != "string" || typeof operation["asset"] != "string"){
					break;
				}
				if(newStat["user"][operation["to"]] == undefined){
					break;
				}
				if(newStat["assets"][operation["asset"]]["owner"] != tx["sender"]){
					break;
				}
				newStat["assets"][operation["asset"]]["owner"] = operation["to"];
			break;
			case "createAccountCustomized":
				// gas for customized create
				if(newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] == undefined){
					break; // insuffient
				}
				if(newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] < 1200000){
					break; // insuffient
				}
				newStat["user"][tx["sender"]]["assets"][operation["e23eb0032b462c19a21983510cd70fd8"]] -= 1200000;
				if(newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] == undefined){
					newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] = 0;
				}
				newStat["user"][miner]["assets"]["e23eb0032b462c19a21983510cd70fd8"] += 1200000;
				// creation
				if(typeof operation["pubkey"] != "string" || typeof operation["name"] != "string"){
					break;
				}
				if(!operation["name"].match("^[a-z0-9\\.\\-_]{3,32}$")){
					break;
				}
				if(operation["name"].substring(0,2) == "w."){
					break;
				}
				if(newStat["user"][operation["name"]] != undefined){
					break;
				}
				newStat["user"][operation["name"]] = {
					"pubkey":operation["pubkey"],"assets":[],"nonce":0
				};
			break;
			case "activeWitteisAccount":
				// creation
				if(typeof operation["pubkey"] != "string"){
					break;
				}
				let account = "w."+sha256(operation["pubkey"]).toString().substring(0,24);
				if(newStat["user"][account] != undefined){
					break;
				}
				newStat["user"][account] = {
					"pubkey":operation["pubkey"],"assets":[],"nonce":0
				};
			break;
			case "setKey":
				if(typeof operation["pubkey"] != "string"){
					break;
				}
				newStat["user"][tx["sender"]]["pubkey"] = operation["pubkey"];
			break;
			case "createNote":
				// Designated operationless operation for social action
				// Operation Structure: {"command":"createNote","noteTitle":title,"noteContent":body_html,"noteParent":parent_note_hash,"tag":tags_array}
				// If some value isn't exists, they will be null
			break;
			case "authWeb2Login":
				// Designated operationless operation for web2 login authenticate
				// Operation Structure: {"command":"authWeb2Login","platform":platform_domain_name,"challgence":challgence}
			break;
			case "mintNFT":
				if(typeof operation["name"] != "string" || typeof operation["metadata"] != "object"){
					break;
				}
				let assetID = sha256(sha256(tx["sender"]).toString()+":"+tx["nonce"]).toString();
				newStat["assets"][assetID] = {
					"name": operation["name"],
					"symbol": "",
					"metadata": operation["metadata"],
					"decimal":1,
					"owner":"acm.system"
				};
				if(newStat["user"][operation["to"]]["assets"][assetID] == undefined){
					newStat["user"][operation["to"]]["assets"][assetID] = 0;
				}
				newStat["user"][operation["to"]]["assets"][assetID] += 1;
			break;
		}
	}
	return newStat;
}

function speterateData(data: string): object{
	let objdata: object = JSON.parse(data);
	if(typeof objdata != "object"){
		return undefined;
	}
	return objdata;
}

function isObjectSame(object1: object, object2: object): boolean {
	var o1keys = Object.keys(object1);
	var o2keys = Object.keys(object2);
	if (o2keys.length !== o1keys.length) return false;
	for (let i = 0; i <= o1keys.length - 1; i++) {
		let key = o1keys[i];
		if (!o2keys.includes(key)) return false;
		if (object2[key] !== object1[key]) return false;
	}
	return true;
}

function validationStateChange(prevData:string,nextData:string): boolean{
	let prevDataObj: object = speterateData(prevData);
	let nextDataObj: object = speterateData(prevData);
	if(prevDataObj == undefined || nextDataObj == undefined){
		return false;
	}
	if(typeof prevDataObj != "object" || typeof nextDataObj != "object" || typeof prevDataObj["state"] != "object" || typeof nextDataObj["state"] != "object" || typeof nextDataObj["miner"] != "string" || typeof nextDataObj["transactions"] != "object"){
		return false;
	}
	return isObjectSame(computeStateChange(prevDataObj["state"],nextDataObj["transactions"],{"miner":nextDataObj["miner"]}),nextDataObj["state"]);
}