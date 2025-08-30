import {Nft} from "../target/types/nft.js";
import { Program, AnchorProvider, workspace, setProvider } from "@coral-xyz/anchor";
import fs from "fs";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccount, getAccount, getMint } from "@solana/spl-token";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

describe("solana-nft", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);

  const program = workspace.Nft as Program<Nft>;

  // balance > 0 的payer
  const secretKeyString = fs.readFileSync("testdata/id.json", { encoding: "utf-8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const payer = Keypair.fromSecretKey(secretKey);

  it("Nft", async () => {
    // 1. create mint
    const mintKeypair = Keypair.generate();
    const mintTx = await program.methods
      .createMint()
      .accounts({
        signer: payer.publicKey,
        mint: mintKeypair.publicKey,
        // tokenProgram: TOKEN_PROGRAM_ID,
        // systemProgram 在idl中已经hard code为11111111111111111111111111111111
      })
      .signers([payer, mintKeypair]) // signer签名交易，mintKeypair签名init mint账户
      .rpc();
    console.log("create mint done, tx：", mintTx);
    const mintInfo = await getMint(provider.connection, mintKeypair.publicKey);
    console.log("mint info: ", mintInfo);

    const name = "My-NFT";
    const symbol = "My-NFT-SYMBOL";
    const uri = "My-NFT-URI";

    // 2. create recipient ata
    // TODO: 应该先创建mint后才能创建ATA
    const ataPublicKey = await createAssociatedTokenAccount(
      provider.connection,
      payer, // payer
      mintKeypair.publicKey, // mint
      payer.publicKey, // owner
    );
    console.log("crate recipient ATA success, ATA: ", ataPublicKey);

    // 3. metadata and master edition
    const metadataProgramPublicKey = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID.toString());
    const metadataRet = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        Buffer.from(metadataProgramPublicKey.toString()),
        mintKeypair.publicKey.toBuffer(),
      ],
      metadataProgramPublicKey,
    );
    const mastEditionRet = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        Buffer.from(metadataProgramPublicKey.toString()),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      metadataProgramPublicKey,
    );

    const tx = await program.methods
      .createNft(name, symbol, uri, 500)
      .accounts({
        payer: payer.publicKey,
        mint: mintKeypair.publicKey,
        recipientAta: ataPublicKey,
        metadata: metadataRet[0],
        masterEdition: mastEditionRet[0],
      })
      .signers([payer,mintKeypair])
      .rpc();
    console.log("create nft success ", tx);

    const recipientAtaInfo = await getAccount(provider.connection, ataPublicKey);
    console.log("recipient ATA info: ", recipientAtaInfo);
  });
})