"""
Long Short-Term Memory
Authors: Sepp Hochreiter, Jürgen Schmidhuber
Year: 1997

本文件是 LSTM 的初学者教程版实现。

LSTM 是一种特殊的循环神经网络（RNN），专门设计用来解决传统 RNN 的
"长期依赖问题"（Long-Term Dependency Problem）。在传统的 RNN 中，
随着时间步的增加，梯度会指数级衰减（梯度消失）或爆炸（梯度爆炸），
导致网络难以学习到远距离的依赖关系。LSTM 通过引入"门控机制"和
"细胞状态"（Cell State），有效地缓解了这个问题。

核心思想：
- 细胞状态 C_t 像一条"传送带"，信息可以在上面相对 unchanged 地流动。
- 三个门（遗忘门、输入门、输出门）控制信息的流动，决定哪些信息
  应该被遗忘、哪些应该被更新、哪些应该被输出。
"""

import math
import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常量
# ---------------------------------------------------------------------------
INPUT_SIZE = 10      # 输入特征的维度（例如词嵌入维度）
HIDDEN_SIZE = 20     # 隐藏状态的维度，也是细胞状态的维度
NUM_LAYERS = 2       # LSTM 的层数（堆叠层数）
SEQ_LEN = 5          # 输入序列的长度（时间步数 T）
BATCH_SIZE = 4       # 批量大小


# ---------------------------------------------------------------------------
# LSTM 单元（单时间步）
# ---------------------------------------------------------------------------
class LSTMCell(nn.Module):
    """
    单个 LSTM 单元，处理一个时间步的数据。

    这是 LSTM 的核心。对于每个时间步 t，它接收：
    - 当前输入 x_t
    - 上一时刻的隐藏状态 h_{t-1}
    - 上一时刻的细胞状态 C_{t-1}

    然后计算并输出：
    - 当前时刻的隐藏状态 h_t
    - 当前时刻的细胞状态 C_t

    论文中的核心公式（严格按 Hochreiter & Schmidhuber, 1997）：
        f_t = sigmoid(W_f · [h_{t-1}, x_t] + b_f)      # 遗忘门
        i_t = sigmoid(W_i · [h_{t-1}, x_t] + b_i)      # 输入门
        C̃_t = tanh(W_C · [h_{t-1}, x_t] + b_C)         # 候选细胞状态
        C_t = f_t * C_{t-1} + i_t * C̃_t                # 细胞状态更新
        o_t = sigmoid(W_o · [h_{t-1}, x_t] + b_o)      # 输出门
        h_t = o_t * tanh(C_t)                          # 隐藏状态
    """

    def __init__(self, input_size: int, hidden_size: int):
        """
        Args:
            input_size:  输入特征的维度
            hidden_size: 隐藏状态和细胞状态的维度
        """
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size

        # 论文中将 h_{t-1} 和 x_t 拼接后一起计算，因此权重矩阵的输入维度是
        # hidden_size + input_size。
        # 这里我们分别为四个门/候选状态定义独立的权重和偏置。

        # 遗忘门（Forget Gate）：决定从细胞状态中丢弃哪些信息
        self.W_f = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.b_f = nn.Parameter(torch.zeros(hidden_size))

        # 输入门（Input Gate）：决定哪些新信息将被存入细胞状态
        self.W_i = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.b_i = nn.Parameter(torch.zeros(hidden_size))

        # 候选细胞状态（Candidate Cell State）：生成新的候选信息
        self.W_C = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.b_C = nn.Parameter(torch.zeros(hidden_size))

        # 输出门（Output Gate）：决定细胞状态的哪些部分将输出为隐藏状态
        self.W_o = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.b_o = nn.Parameter(torch.zeros(hidden_size))

        # 参数初始化：使用均匀分布，范围与 hidden_size 相关
        self._reset_parameters()

    def _reset_parameters(self):
        """初始化参数。论文中没有明确指定初始化方法，这里采用常见的 RNN 初始化。"""
        std = 1.0 / math.sqrt(self.hidden_size)
        for p in self.parameters():
            nn.init.uniform_(p, -std, std)

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor, C_prev: torch.Tensor):
        """
        前向传播，处理单个时间步。

        Args:
            x_t:    (B, input_size)      当前时间步的输入
            h_prev: (B, hidden_size)     上一时刻的隐藏状态
            C_prev: (B, hidden_size)     上一时刻的细胞状态

        Returns:
            h_t:    (B, hidden_size)     当前时刻的隐藏状态
            C_t:    (B, hidden_size)     当前时刻的细胞状态
        """
        # 将上一时刻的隐藏状态和当前输入拼接
        # 形状从 (B, hidden_size) 和 (B, input_size) 变为 (B, hidden_size + input_size)
        hx = torch.cat([h_prev, x_t], dim=-1)

        # 遗忘门：输出 0~1 之间的值，0 表示完全遗忘，1 表示完全保留
        f_t = torch.sigmoid(torch.matmul(hx, self.W_f.t()) + self.b_f)

        # 输入门：同样输出 0~1，控制新信息的流入程度
        i_t = torch.sigmoid(torch.matmul(hx, self.W_i.t()) + self.b_i)

        # 候选细胞状态：使用 tanh 输出 -1~1 的候选值
        C_tilde_t = torch.tanh(torch.matmul(hx, self.W_C.t()) + self.b_C)

        # 细胞状态更新：
        # - 遗忘门 f_t 控制保留多少旧的细胞状态 C_prev
        # - 输入门 i_t 控制加入多少新的候选状态 C_tilde_t
        C_t = f_t * C_prev + i_t * C_tilde_t

        # 输出门：控制细胞状态的哪些信息将被输出
        o_t = torch.sigmoid(torch.matmul(hx, self.W_o.t()) + self.b_o)

        # 隐藏状态：输出门与经过 tanh 的细胞状态相乘
        # tanh 将细胞状态压缩到 -1~1 范围
        h_t = o_t * torch.tanh(C_t)

        return h_t, C_t


# ---------------------------------------------------------------------------
# 多层 LSTM
# ---------------------------------------------------------------------------
class LSTM(nn.Module):
    """
    多层（堆叠）LSTM 网络。

    每一层都是一个 LSTMCell，层与层之间是垂直堆叠的：
    - 第 0 层接收原始输入 x
    - 第 l 层接收第 l-1 层的隐藏状态作为输入
    - 最终输出是最后一层在所有时间步的隐藏状态

    这种堆叠结构可以让网络学习更复杂的层次化特征表示。
    """

    def __init__(self, input_size: int, hidden_size: int, num_layers: int = 1):
        """
        Args:
            input_size:  输入特征的维度
            hidden_size: 每层隐藏状态的维度
            num_layers:  LSTM 的层数
        """
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # 为每一层创建一个 LSTMCell
        self.cells = nn.ModuleList()
        for l in range(num_layers):
            # 第 0 层的输入维度是 input_size，其他层的输入维度是 hidden_size
            # 因为上一层的输出（隐藏状态）维度就是 hidden_size
            layer_input_size = input_size if l == 0 else hidden_size
            self.cells.append(LSTMCell(layer_input_size, hidden_size))

    def forward(self, x: torch.Tensor, h0: torch.Tensor = None, C0: torch.Tensor = None):
        """
        前向传播，处理整个序列。

        Args:
            x:   (B, T, input_size)                输入序列
            h0:  (num_layers, B, hidden_size)      初始隐藏状态，可为 None
            C0:  (num_layers, B, hidden_size)      初始细胞状态，可为 None

        Returns:
            output: (B, T, hidden_size)            最后一层在所有时间步的隐藏状态
            h_n:    (num_layers, B, hidden_size)   最后时刻所有层的隐藏状态
            C_n:    (num_layers, B, hidden_size)   最后时刻所有层的细胞状态
        """
        B, T, _ = x.size()  # B: batch size, T: sequence length

        # 如果未提供初始状态，则初始化为零
        if h0 is None:
            h0 = x.new_zeros(self.num_layers, B, self.hidden_size)
        if C0 is None:
            C0 = x.new_zeros(self.num_layers, B, self.hidden_size)

        # 将初始状态拆分为每层一个张量，方便逐层更新
        h_list = [h0[l] for l in range(self.num_layers)]
        C_list = [C0[l] for l in range(self.num_layers)]

        outputs = []
        # 遍历每个时间步
        for t in range(T):
            layer_input = x[:, t, :]  # 当前时间步的输入: (B, input_size)
            # 逐层前向传播
            for l in range(self.num_layers):
                # 使用第 l 层的 LSTMCell 计算新的隐藏状态和细胞状态
                h_list[l], C_list[l] = self.cells[l](layer_input, h_list[l], C_list[l])
                # 当前层的隐藏状态作为下一层的输入
                layer_input = h_list[l]
            # 收集最后一层在当前时间步的隐藏状态
            outputs.append(h_list[-1])

        # 将所有时间步的输出堆叠起来
        output = torch.stack(outputs, dim=1)  # 形状: (B, T, hidden_size)

        # 将最后时刻的各层状态堆叠起来
        h_n = torch.stack(h_list, dim=0)      # 形状: (num_layers, B, hidden_size)
        C_n = torch.stack(C_list, dim=0)      # 形状: (num_layers, B, hidden_size)

        return output, h_n, C_n


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型
    model = LSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS)

    # 创建随机输入数据
    # 形状: (batch_size, seq_len, input_size)
    x = torch.randn(BATCH_SIZE, SEQ_LEN, INPUT_SIZE)

    # 前向传播
    output, h_n, C_n = model(x)

    print("=" * 50)
    print("LSTM 前向传播结果")
    print("=" * 50)
    print(f"输入数据形状:      {x.shape}")
    print(f"输出序列形状:      {output.shape}")
    print(f"最终隐藏状态形状:  {h_n.shape}")
    print(f"最终细胞状态形状:  {C_n.shape}")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"模型总参数量:      {total_params}")
    print("=" * 50)

    # 解释输出
    print("\n输出说明:")
    print("- output: 最后一层在每个时间步的隐藏状态，可用于序列标注等任务")
    print("- h_n:    最后时刻每一层的隐藏状态，可用于序列分类等任务")
    print("- C_n:    最后时刻每一层的细胞状态，包含长期记忆信息")

    # 练习建议
    print("\n" + "=" * 50)
    print("练习建议（读者可自行尝试）")
    print("=" * 50)
    print("1. 修改 NUM_LAYERS 观察参数量和输出形状的变化")
    print("2. 修改 HIDDEN_SIZE 观察模型容量的变化")
    print("3. 尝试提供自定义的 h0 和 C0，观察对输出的影响")
    print("4. 将 output 的最后一个时间步用于分类任务（如情感分析）")
    print("5. 对比本实现与 torch.nn.LSTM 的输出差异")
