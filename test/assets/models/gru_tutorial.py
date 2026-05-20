"""
Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation
Kyunghyun Cho, Bart van Merrienboer, Caglar Gulcehre, Dzmitry Bahdanau, Fethi Bougares, Holger Schwenk, Yoshua Bengio
2014
arXiv: https://arxiv.org/abs/1406.1078

初学者友好的 GRU (Gated Recurrent Unit, 门控循环单元) 实现教程。

GRU 是什么？
- GRU 是一种循环神经网络 (RNN) 的变体，用于处理序列数据（如文本、时间序列）。
- 相比普通 RNN，GRU 通过"门控机制"解决了长序列上的梯度消失问题。
- 相比 LSTM，GRU 结构更简单（只有2个门，LSTM有3个门），参数量少约25%，效果通常相近。

关键概念 (Key Concepts):
1. 更新门 (Update Gate): 控制前一时刻隐藏状态有多少信息被保留到当前时刻。
2. 重置门 (Reset Gate): 控制前一时刻隐藏状态有多少信息被用来计算候选隐藏状态。
3. 候选隐藏状态 (Candidate Hidden State): 基于当前输入和"重置后"的前一状态计算出的新状态候选。
4. 隐藏状态 (Hidden State): 最终状态，是前一状态和候选状态的加权组合，权重由更新门决定。
"""

import torch
import torch.nn as nn


# ========================== 配置常量 ==========================
# 这些常量定义了模型的规模，你可以修改它们来观察模型行为的变化

INPUT_SIZE = 128      # 输入特征维度：每个时间步的输入向量有多少个数字
HIDDEN_SIZE = 256     # 隐藏状态维度：GRU 内部记忆向量的大小，越大表示记忆能力越强
NUM_LAYERS = 2        # 堆叠层数：多层 GRU 可以学习更复杂的层次化表示
BATCH_SIZE = 4        # 批量大小：一次处理多少个序列
SEQ_LEN = 10          # 序列长度：每个输入样本有多少个时间步


class GRUCell(nn.Module):
    """
    单个 GRU 单元（单步前向传播）。

    GRU 的核心思想：在每个时间步，用两个"门"来决定如何更新隐藏状态。
    - 不需要像 LSTM 那样维护细胞状态和隐藏状态两个向量，GRU 只有一个隐藏状态。
    - 这使得 GRU 更简单、参数更少、计算更快。

    公式（严格按论文）：
        更新门:  z_t = sigmoid(W_z · [h_{t-1}, x_t])
        重置门:  r_t = sigmoid(W_r · [h_{t-1}, x_t])
        候选状态: h̃_t = tanh(W · [r_t * h_{t-1}, x_t])
        隐藏状态: h_t = (1 - z_t) * h_{t-1} + z_t * h̃_t
    """

    def __init__(self, input_size: int, hidden_size: int):
        """
        初始化 GRU 单元。

        Args:
            input_size:  输入特征的维度（每个时间步输入向量的长度）
            hidden_size: 隐藏状态的维度（GRU 内部记忆向量的大小）
        """
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size

        # 三个线性变换层，对应论文中的三个权重矩阵 W_r, W_z, W
        # 注意：论文中将 h_{t-1} 和 x_t 拼接后做一次矩阵乘法，这里用 nn.Linear 实现
        # input_size + hidden_size 是因为输入是 [h_{t-1}, x_t] 的拼接

        # W_r: 重置门的权重，输出经过 sigmoid 得到重置门 r_t（0~1之间）
        self.W_r = nn.Linear(input_size + hidden_size, hidden_size)

        # W_z: 更新门的权重，输出经过 sigmoid 得到更新门 z_t（0~1之间）
        self.W_z = nn.Linear(input_size + hidden_size, hidden_size)

        # W: 候选隐藏状态的权重，输出经过 tanh 得到候选状态 h̃_t（-1~1之间）
        self.W = nn.Linear(input_size + hidden_size, hidden_size)

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor) -> torch.Tensor:
        """
        单步前向传播。

        Args:
            x_t:    当前时间步的输入，形状 (batch_size, input_size)
            h_prev: 前一时刻的隐藏状态，形状 (batch_size, hidden_size)

        Returns:
            h_t: 当前时刻的隐藏状态，形状 (batch_size, hidden_size)
        """
        # 第一步：将前一隐藏状态和当前输入拼接
        # 形状变化: (batch, hidden) + (batch, input) -> (batch, hidden + input)
        concat = torch.cat([h_prev, x_t], dim=-1)

        # 第二步：计算重置门 r_t
        # 重置门决定"忘记"多少过去的信息
        # 形状: (batch, hidden + input) -> (batch, hidden)
        r_t = torch.sigmoid(self.W_r(concat))

        # 第三步：计算更新门 z_t
        # 更新门决定用多少新信息来更新状态
        # 形状: (batch, hidden + input) -> (batch, hidden)
        z_t = torch.sigmoid(self.W_z(concat))

        # 第四步：计算候选隐藏状态 h̃_t
        # 先将前一状态按重置门进行"过滤"，再与输入拼接
        # 形状: (batch, hidden) * (batch, hidden) -> (batch, hidden)
        # 拼接后: (batch, hidden) + (batch, input) -> (batch, hidden + input)
        concat_reset = torch.cat([r_t * h_prev, x_t], dim=-1)

        # 经过 tanh 得到候选状态，范围在 -1~1 之间
        # 形状: (batch, hidden + input) -> (batch, hidden)
        h_tilde = torch.tanh(self.W(concat_reset))

        # 第五步：计算最终隐藏状态 h_t
        # (1 - z_t) * h_prev: 保留多少旧状态
        # z_t * h_tilde:      采纳多少新候选状态
        # 两者相加得到最终状态
        # 形状: (batch, hidden)
        h_t = (1 - z_t) * h_prev + z_t * h_tilde

        return h_t


class GRU(nn.Module):
    """
    多层 GRU 网络，用于处理整个序列。

    多层结构：
    - 第1层接收原始输入序列
    - 第2层接收第1层的输出序列作为输入
    - 以此类推...

    这种堆叠方式让网络学习层次化特征：
    - 底层捕捉局部/短程模式
    - 高层捕捉全局/长程模式
    """

    def __init__(self, input_size: int, hidden_size: int, num_layers: int = 1):
        """
        初始化多层 GRU。

        Args:
            input_size:  输入特征维度
            hidden_size: 隐藏状态维度（每一层都一样）
            num_layers:  堆叠的 GRU 层数，默认为1
        """
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # 用 ModuleList 存储每一层的 GRUCell
        # 第0层的输入维度是 input_size，后续层的输入维度是 hidden_size
        self.cells = nn.ModuleList()
        for layer in range(num_layers):
            layer_input_size = input_size if layer == 0 else hidden_size
            self.cells.append(GRUCell(layer_input_size, hidden_size))

    def forward(self, x: torch.Tensor, h_0: torch.Tensor = None) -> tuple[torch.Tensor, torch.Tensor]:
        """
        处理整个输入序列。

        Args:
            x:   输入序列，形状 (batch_size, seq_len, input_size)
                 batch_size: 同时处理多少个序列
                 seq_len:    每个序列有多少个时间步
                 input_size: 每个时间步的特征维度
            h_0: 初始隐藏状态，形状 (num_layers, batch_size, hidden_size)
                 如果不提供，则自动初始化为全0

        Returns:
            output: 每一时刻最上层的隐藏状态，形状 (batch_size, seq_len, hidden_size)
                    常用于序列标注、语言模型等任务
            h_n:    最后时刻所有层的隐藏状态，形状 (num_layers, batch_size, hidden_size)
                    常用于句子编码、条件生成等任务
        """
        batch_size, seq_len, _ = x.shape
        device = x.device

        # 如果没有提供初始隐藏状态，自动创建全0向量
        if h_0 is None:
            h_0 = torch.zeros(self.num_layers, batch_size, self.hidden_size, device=device)

        # h_t 存储当前时刻所有层的隐藏状态
        # 初始化时为 h_0
        h_t = h_0

        # 收集每个时间步最上层的输出
        outputs = []

        # 按时间步逐个处理
        for t in range(seq_len):
            # 取出第 t 个时间步的输入，形状 (batch_size, input_size)
            x_t = x[:, t, :]

            # 逐层传播
            for layer, cell in enumerate(self.cells):
                # 当前层的输入是上一层的输出（或原始输入）
                # 更新当前层的隐藏状态
                h_t[layer] = cell(x_t, h_t[layer])

                # 当前层的输出作为下一层的输入
                x_t = h_t[layer]

            # 最上层的输出加入输出列表
            outputs.append(x_t)

        # 将所有时间步的输出堆叠成张量
        # 形状: (batch_size, seq_len, hidden_size)
        output = torch.stack(outputs, dim=1)

        return output, h_t


if __name__ == "__main__":
    # ========================== 教育演示 ==========================

    print("=" * 60)
    print("GRU 教育演示")
    print("=" * 60)

    # 创建模型
    model = GRU(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS)

    # 创建随机输入数据（模拟4个序列，每个序列10个时间步，每个时间步128维特征）
    x = torch.randn(BATCH_SIZE, SEQ_LEN, INPUT_SIZE)

    # 前向传播
    output, h_n = model(x)

    # 打印形状信息
    print(f"\n输入形状:      {x.shape}")
    print(f"输出形状:      {output.shape}")
    print(f"最终隐藏状态:  {h_n.shape}")

    # 参数量统计
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n总参数量: {total_params:,}")

    # 逐层参数量
    for i, cell in enumerate(model.cells):
        cell_params = sum(p.numel() for p in cell.parameters())
        print(f"  第{i}层参数量: {cell_params:,}")

    print("\n" + "=" * 60)
    print("练习建议 (Exercises):")
    print("=" * 60)
    print("1. 修改 NUM_LAYERS 观察输出形状和参数量的变化")
    print("2. 修改 HIDDEN_SIZE 观察模型容量的变化")
    print("3. 尝试给 h_0 传入非零的初始状态，观察输出变化")
    print("4. 对比相同配置下 LSTM 和 GRU 的参数量差异")
    print("5. 思考：为什么 GRU 比 LSTM 少一个门？这带来了什么 trade-off？")
