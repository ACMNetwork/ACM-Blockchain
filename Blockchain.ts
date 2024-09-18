import { Block } from "./Block";
import { validationStateChange,computeStateChange } from "./BlockData";
import fs from 'fs';
const { generateKeyPairSync } = require('crypto');

export class Blockchain {
  chain: Block[]; // 区块链
  difficulty: number; // 工作量证明难度
  dataPath: string; // 区块链数据文件路径

  // 区块链高度，直接使用chain.length
  get height(): number {
    return this.chain.length;
  }

  constructor(
    dataPath: string = 'blockchain.json',
  ) {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.dataPath = dataPath;

    this.loadChainFromFile();

    // 系统崩溃时，保存区块链到文件
    process.on('exit', () => this.saveChainToFile());
  }

  // 创建创世区块
  createGenesisBlock(): Block {
    return new Block(0, '2024-09-18 ', JSON.stringify({
		state:{
			"user":{
				"admin":{
					"pubKey":fs.readFileSync("./bootuser-pubkey", 'utf8'),
					"assets":{
						"e23eb0032b462c19a21983510cd70fd8":19660548731947
					},
					"nonce":0
				},
				"acm.system":{
					"pubKey":"NOT-PUBLIC-KEY",
					"assets":{},
					"nonce":0
				}
			},
			"assets":{
				"e23eb0032b462c19a21983510cd70fd8":{
					"name":"ACM Cash",
					"symbol":"ACM",
					"owner":"acm.system",
					"decimal":6,
					"metadata":{}
				}
			}
		},
		transactions:[],
		"miner":"acm.system"
	}), "0");
  }

  // 获取最新区块
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  // 添加新区块（调试）
  addBlock(newBlock: Block): void {
    newBlock.previousHash = this.getLatestBlock().hash;
	newBlock.index = this.chain.length;
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    this.saveChainToFile();
  }
  // 正常挖矿
  addTransactBlock(transactions: object,miner: string): void {
	let data = JSON.stringify({
		"transactions":transactions,
		"state":computeStateChange(this.getLatestBlock().data,transactions,{"miner":miner}),
		"miner":miner
	});
	let newBlock = new Block(this.chain.length,Date.now().toISOString(),data,this.getLatestBlock().hash);
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    this.saveChainToFile();
  }

  // 验证区块链是否有效
  isChainValid(chain?: Block[]): boolean {
    const targetChain = chain || this.chain;
    for (let i = 1; i < targetChain.length; i++) {
      const currentBlock = targetChain[i];
      const previousBlock = targetChain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
	  // 检查执行层合法性
	  if(!validationStateChange(previousBlock.data,currentBlock.data)){
		return false;
	  }
    }
    return true;
  }

  // 保存区块链到文件
  saveChainToFile(): void {
    try {
      // 保存之前校验链是否被篡改
      if (this.isChainValid() === false) {
        console.error('Blockchain is not valid, not saving to file');
        return;
      }
      const jsonContent = JSON.stringify(this.chain, null, 2);
      fs.writeFileSync(this.dataPath, jsonContent, 'utf8');
    } catch (error) {
      console.error('Error saving the blockchain to a file', error);
    }
  }

  // 从文件加载区块链
  loadChainFromFile(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const fileContent = fs.readFileSync(this.dataPath, 'utf8');
        const loadedChain = JSON.parse(fileContent);
        this.chain = loadedChain.map((blockData: any) => {
          const block = new Block(blockData.index, blockData.timestamp, blockData.data, blockData.previousHash);
          block.nonce = blockData.nonce;
          block.hash = block.calculateHash();
          return block;
        });

        // 加载之后校验链是否被篡改
        if (this.isChainValid() === false) {
          console.error('Blockchain is not valid after loading from file');
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error loading the blockchain from a file', error);
    }
  }
}