# Solana spl - Anchor

## Anchor Installation
[installation](https://www.anchor-lang.com/docs/installation)
## Run Devnet
```shell
yarn install
anchor build
anchor deploy // 这里执行可能会报错，有可能buffer size too small 或者上次执行中断导致  删除buffer后重新执行
anchor keys sync
# 更新target/idl里的address、target/typs里的address  然后anchor run test 或者 anchor test --skip-build --skip-deploy
       # 会报错Error: AnchorError occurred. Error Code: DeclaredProgramIdMismatch. Error Number: 4100. Error Message: The declared program id does not match the actual program id.
anchor build && anchor upgrade -p <progrmID> filepath => 更新programID后需要重新部署一下，可能是第一次部署后program里的declare_id!("ProgramID")和部署后生成的新的programID不匹配
anchor run test
```

## anchor deploy errors
### Error: Buffer account data size (249501) is smaller than the minimum size (266789)
可能是部署成功后更改了program，编译后的.so文件变大了，导致前面使用的buffer size不够用

查看wallet下的BUFFER Addresses: solana program show --buffers

删除他们(可能需要等一会才能删除完成)：solana program close <BUFFER_KEY>
### [ERROR solana_cli::program] AlreadyProcessed
1. 上一次执行中断了，删除buffers后重新执行deploy
2. declare_id!(programID) 这个programID是被close的，换一个其他的programId重新编译部署