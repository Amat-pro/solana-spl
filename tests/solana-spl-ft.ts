import pkg from '@coral-xyz/anchor';
const { BN } = pkg; // !!!
import { Program ,workspace, AnchorProvider, setProvider } from "@coral-xyz/anchor";
import { SolanaSpl } from "../target/types/solana_spl.js";
import { Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAccount,
  getMint
} from "@solana/spl-token";
import fs from "fs";

describe("solana-ft", () => {
  // 1. 设置Anchor Provider
  const provider = AnchorProvider.env();
  setProvider(provider);

  // 2. program
  const program = workspace.SolanaSpl as Program<SolanaSpl>;

  // // 3. test account
  // const signer = Keypair.generate();
  //
  // // 4. airdrop一些SOL用于支付费用
  // before(async () => {
  //   const sig = await provider.connection.requestAirdrop(
  //     signer.publicKey,
  //     2 * anchor.web3.LAMPORTS_PER_SOL // 2 sol
  //   );
  //   const latestBlockhash = await provider.connection.getLatestBlockhash();
  //   await provider.connection.confirmTransaction(
  //     {
  //       signature: sig,
  //       blockhash: latestBlockhash.blockhash,
  //       lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  //     },
  //     "confirmed"
  //   );
  // });
  // balance > 0 的payer
  const secretKeyString = fs.readFileSync("testdata/id.json", { encoding: "utf-8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const signer = Keypair.fromSecretKey(secretKey);

  it("Create Mint", async () => {
    const mintKeypair = Keypair.generate();

    const tx = await program.methods
      .createMint()
      .accounts({
        signer: signer.publicKey,
        mint: mintKeypair.publicKey,
        // tokenProgram: TOKEN_PROGRAM_ID,
        // systemProgram 在idl中已经hard code为11111111111111111111111111111111
      })
      .signers([signer, mintKeypair]) // signer签名交易，mintKeypair签名init mint账户
      .rpc();

    console.log("Mint创建交易签名：", tx);

  });

  it("Tokens", async () => {
    // 1. create mint
    const mintKeypair = Keypair.generate();
    const mintTx = await program.methods
      .createMint()
      .accounts({
        signer: signer.publicKey,
        mint: mintKeypair.publicKey,
        // tokenProgram: TOKEN_PROGRAM_ID,
        // systemProgram 在idl中已经hard code为11111111111111111111111111111111
      })
      .signers([signer, mintKeypair]) // signer签名交易，mintKeypair签名init mint账户
      .rpc();
    console.log("create mint done, tx：", mintTx);
    const mintInfo = await getMint(provider.connection, mintKeypair.publicKey);
    console.log("mint info: ", mintInfo);

    // 2. create ATA
    const ataPublicKey = await createAssociatedTokenAccount(
      provider.connection,
      signer, // payer
      mintKeypair.publicKey, // mint
      signer.publicKey, // owner
    );
    console.log("crate ATA success, ATA: ", ataPublicKey);

    // 3. mint tokens
    const amount = new BN(10 * (10 ** mintInfo.decimals));
    const createTokenTx = await program.methods
      .mintTokens(amount)
      .accounts({
        signer: signer.publicKey,
        tokenAccount: ataPublicKey,
        mint: mintKeypair.publicKey,
        // tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([signer])
      .rpc();
    console.log("create tokens to ATA %s done. tx: ", ataPublicKey, createTokenTx);

    // 查询ATA余额
    const ataInfo = await getAccount(provider.connection, ataPublicKey);
    console.log("ATA info: ", ataInfo);

    // 查询Mint Supply
    const mintInfo2 = await getMint(provider.connection, mintKeypair.publicKey);
    console.log("Mint info: ", mintInfo2);

    // 4. transfer tokens ataPublicKey -> ataToPublicKey
    const owner = Keypair.generate(); // signer已经有这个Mint的ATA了，需要创建另一个owner
    const ataToPublicKey = await createAssociatedTokenAccount(
      provider.connection,
      signer, // payer
      mintKeypair.publicKey, // mint
      owner.publicKey, // owner
    );
    console.log("crate ATA To success, ATA: ", ataToPublicKey);

    const transferTx = await program.methods
      .transferTokens(new BN((10 ** mintInfo.decimals)))
      .accounts({
        from: ataPublicKey,
        to: ataToPublicKey,
        mint: mintKeypair.publicKey,
        authority: signer.publicKey,
        // tokenProgram:TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc();
    console.log("transfer tokens success: ", transferTx);

    // 查询ATA余额
    const ataInfo2 = await getAccount(provider.connection, ataPublicKey);
    console.log("ATA From info: ", ataInfo2);

    // 查询ATA余额
    const ataInfo3 = await getAccount(provider.connection, ataToPublicKey);
    console.log("ATA To info: ", ataInfo3);

    // 查询Mint Supply
    const mintInfo3 = await getMint(provider.connection, mintKeypair.publicKey);
    console.log("Mint info: ", mintInfo3);

  });
});

// Output:
//   solana-ft
// Mint创建交易签名： 3aPVS4sMNc4d4ibna3g3w5zfX5EoFMrg2tPyy7mLtLPoAZdv7ebTbWAwGzULu9QG1Ehw4U1h9U3pkZ2RdnMkA9AD
//     ✔ Create Mint (453ms)
// create mint done, tx： 3Z3oHQxsbYBqn7kFEiEigszULcxJetadtW1GQrqC7bwpuL7QezP3zh9EvenTPvAiDXVVXsYjVmxDS8JxkUtoCg8y
// mint info:  {
//   address: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   mintAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   supply: 0n,
//   decimals: 6,
//   isInitialized: true,
//   freezeAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   tlvData: <Buffer >
// }
// crate ATA success, ATA:  PublicKey [PublicKey(EhQnr9s5LSUhnpZjCQUJFdKLerLPN7diymhBwSbobK8W)] {
//   _bn: <BN: cb820ff81df369afbecf1dbbd8f0e0731f9b893f58f59cde0854f81c7be86ceb>
// }
// create tokens to ATA EhQnr9s5LSUhnpZjCQUJFdKLerLPN7diymhBwSbobK8W done. tx:  3KxmZMQMEVu5NgBxF8RtipBGq8R13gg8fcaJHGfUt4iJGrtcuCess85CEe73RqJkffpZso4pmmdHuGiS3DjHbJvG
// ATA info:  {
//   address: PublicKey [PublicKey(EhQnr9s5LSUhnpZjCQUJFdKLerLPN7diymhBwSbobK8W)] {
//     _bn: <BN: cb820ff81df369afbecf1dbbd8f0e0731f9b893f58f59cde0854f81c7be86ceb>
//   },
//   mint: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   owner: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   amount: 10000000n,
//   delegate: null,
//   delegatedAmount: 0n,
//   isInitialized: true,
//   isFrozen: false,
//   isNative: false,
//   rentExemptReserve: null,
//   closeAuthority: null,
//   tlvData: <Buffer >
// }
// Mint info:  {
//   address: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   mintAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   supply: 10000000n,
//   decimals: 6,
//   isInitialized: true,
//   freezeAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   tlvData: <Buffer >
// }
// crate ATA To success, ATA:  PublicKey [PublicKey(6GYNRUjxkLNU27PB2o99QZiJs5ZGMPPfQtL1afJaM84d)] {
//   _bn: <BN: 4e459dbf4759a84524a81f8aafc395416bc17058226134ffe36415400a82609e>
// }
// transfer tokens success:  4YHLV6UEL49xY53Z6KUVrbG5RJQvgTR2xJBff7SshHCrm6iqftn6qXLLz5jVsj5h6ZKcxrKP63oy2f2xZpGUVB2w
// ATA From info:  {
//   address: PublicKey [PublicKey(EhQnr9s5LSUhnpZjCQUJFdKLerLPN7diymhBwSbobK8W)] {
//     _bn: <BN: cb820ff81df369afbecf1dbbd8f0e0731f9b893f58f59cde0854f81c7be86ceb>
//   },
//   mint: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   owner: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   amount: 9000000n,
//   delegate: null,
//   delegatedAmount: 0n,
//   isInitialized: true,
//   isFrozen: false,
//   isNative: false,
//   rentExemptReserve: null,
//   closeAuthority: null,
//   tlvData: <Buffer >
// }
// ATA To info:  {
//   address: PublicKey [PublicKey(6GYNRUjxkLNU27PB2o99QZiJs5ZGMPPfQtL1afJaM84d)] {
//     _bn: <BN: 4e459dbf4759a84524a81f8aafc395416bc17058226134ffe36415400a82609e>
//   },
//   mint: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   owner: PublicKey [PublicKey(4GE3TGCU9fyKKGQDPPkq15V19PECJkNUdykwr8ktasrb)] {
//     _bn: <BN: 30798516ca088e6288fa1ba4708ec2cafcd2dc708d8cc217dd3c2b41cd0209bc>
//   },
//   amount: 1000000n,
//   delegate: null,
//   delegatedAmount: 0n,
//   isInitialized: true,
//   isFrozen: false,
//   isNative: false,
//   rentExemptReserve: null,
//   closeAuthority: null,
//   tlvData: <Buffer >
// }
// Mint info:  {
//   address: PublicKey [PublicKey(BpcSJL2MZn7qohsg3wTkYzNy4Li7RSp8v6ayUSSucM9c)] {
//     _bn: <BN: a0c73c3058eee93cfa2280bca721919eff2cbbfd5eb08858ed6e97794ce2d5db>
//   },
//   mintAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   supply: 10000000n,
//   decimals: 6,
//   isInitialized: true,
//   freezeAuthority: PublicKey [PublicKey(FSvkQgQeRx6617aUio9kF7xsPSgZ55Z2NXd3VfTZQRHV)] {
//     _bn: <BN: d6a7e9255a9799c53bb3f8aebe45a2bbcbf1a5791ab67f527b13f2db33e11a74>
//   },
//   tlvData: <Buffer >
// }
//     ✔ Tokens (2454ms)
//
//
//   2 passing (3s)
//
// ✨  Done in 4.58s.