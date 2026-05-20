"""
用现代 PyTorch 框架复现 BP（反向传播）神经网络
论文：Learning representations by back-propagating errors
      (Rumelhart, Hinton & Williams, Nature 1986)

这个文件展示的是 "现代工程写法" —— 用 PyTorch 现成的工具搭网络、算梯度。
你可以对比 `backpropagation.py`（手动求导版）来理解 PyTorch 帮我们省去了哪些工作。
"""

import torch
import torch.nn as nn
import torch.optim as optim


# ============================================================================
# 第一步：定义神经网络结构
# ============================================================================
# 论文中的网络是一个"全连接前馈神经网络"：
#
#   输入层 → 隐藏层（sigmoid激活）→ 输出层（sigmoid激活）
#
# 我们用 PyTorch 的 nn.Module 来搭建它。
# nn.Module 是 PyTorch 中所有神经网络的基类，我们继承它就行。
# ----------------------------------------------------------------------------

class BPNetwork(nn.Module):
    """
    一个通用的多层感知机（MLP）。

    参数:
        layers: 列表，每层的神经元个数
                例如 [2, 4, 1] 表示：
                - 输入层：2个神经元
                - 隐藏层：4个神经元（sigmoid激活）
                - 输出层：1个神经元（sigmoid激活）
    """

    def __init__(self, layers):
        super().__init__()

        # 用 ModuleList 来存放每一层
        # 每一层是一个 nn.Linear（全连接层）
        self.linears = nn.ModuleList()

        for i in range(len(layers) - 1):
            # nn.Linear(输入特征数, 输出特征数)
            # 它内部自动管理权重 W 和偏置 b
            self.linears.append(nn.Linear(layers[i], layers[i + 1]))

        # 初始化权重和偏置（用小的随机数，和论文一致）
        self._init_weights()

    def _init_weights(self):
        for linear in self.linears:
            # 均匀分布 U(-0.3, 0.3)
            nn.init.uniform_(linear.weight, -0.3, 0.3)
            nn.init.uniform_(linear.bias, -0.3, 0.3)

    def forward(self, x):
        """
        前向传播：输入 x --> 输出 y_pred

        这里的计算和论文中的公式完全对应：
            net_j = Σ_i w_ji * o_i + b_j     （加权求和）
            o_j = 1 / (1 + exp(-net_j))       （sigmoid 激活）
        """
        # 遍历所有层（除了最后一层），每一层后接 sigmoid 激活
        for i in range(len(self.linears) - 1):
            x = torch.sigmoid(self.linears[i](x))

        # 最后一层也接 sigmoid（论文中输出层也是 logistic 单元）
        x = torch.sigmoid(self.linears[-1](x))

        return x


# ============================================================================
# 第二步：训练函数
# ============================================================================
# 训练过程：
#   1. 前向传播：输入数据 → 得到预测值
#   2. 计算损失：预测值 和 真实值 的差距
#   3. 反向传播：自动计算每个权重的梯度（PyTorch自动完成！）
#   4. 更新权重：沿着梯度反方向走一小步
# ----------------------------------------------------------------------------

def train_model(model, X, y, epochs=2000, lr=0.5, momentum=0.9):
    """
    训练神经网络。

    参数:
        model: 要训练的模型
        X: 输入数据
        y: 真实标签
        epochs: 训练轮数
        lr: 学习率（η）— 每次更新的步长
        momentum: 动量（α）— 加速收敛
    """
    # ---- 损失函数 ----
    # 论文中使用的是"均方误差"（MSE）：
    #   E = 0.5 * Σ(t - o)²
    loss_fn = nn.MSELoss()

    # ---- 优化器 ----
    # SGD = 随机梯度下降（Stochastic Gradient Descent）
    # PyTorch 会自动帮我们完成：
    #   Δw = -η * ∂E/∂w          （式 7）
    #   Δw(t) = α·Δw(t-1) - η·∂E/∂w  （式 8，带动量）
    optimizer = optim.SGD(model.parameters(), lr=lr, momentum=momentum)

    for epoch in range(epochs):
        # ---- 前向传播 ----
        y_pred = model(X)

        # ---- 计算损失 ----
        loss = loss_fn(y_pred, y)

        # ---- 反向传播 ----
        # .backward() 是 PyTorch 最核心的函数！
        # 它会自动计算 loss 对每个参数的梯度（链式法则）
        # 你在 backpropagation.py 中手写的所有链式法则公式，
        # 这里一行代码就全部自动完成了。
        optimizer.zero_grad()  # 清空上一次的梯度
        loss.backward()       # 自动反向传播，计算梯度

        # ---- 更新权重 ----
        # 沿着梯度反方向更新所有参数
        optimizer.step()

        # 每 500 轮打印一次损失
        if epoch % 500 == 0:
            print(f"    第 {epoch:4d} 轮  ——  损失 = {loss.item():.6f}")


# ============================================================================
# 第三步：用训练好的网络做预测
# ============================================================================

def predict(model, X):
    """用训练好的模型做预测。"""
    model.eval()  # 切换到评估模式
    with torch.no_grad():  # 关闭梯度计算（推理时不需要）
        return model(X)


# ============================================================================
# 第四步：开始实验
# ============================================================================

def demo_xor():
    """
    Demo 1：XOR（异或）问题

    XOR 是经典的非线性问题——单层感知机无法解决。
    1986 年的论文用 BP 网络成功解决了它，证明了"多层+反向传播"的有效性。

    XOR 数据集：
        输入 → 输出
        0,0 → 0
        0,1 → 1
        1,0 → 1
        1,1 → 0
    """
    print("=" * 60)
    print("实验一：XOR（异或）—— 经典的非线性分类问题")
    print("=" * 60)
    print()
    print("  网络结构：2个输入 → 4个隐藏神经元 → 1个输出")
    print()

    # 设置随机种子（保证每次运行结果一致）
    torch.manual_seed(42)

    # ---- 创建模型 ----
    model = BPNetwork([2, 4, 1])

    # ---- 准备数据 ----
    X = torch.tensor([
        [0.0, 0.0],  # 样本 1
        [0.0, 1.0],  # 样本 2
        [1.0, 0.0],  # 样本 3
        [1.0, 1.0],  # 样本 4
    ])
    y = torch.tensor([
        [0.0],  # 标签 1
        [1.0],  # 标签 2
        [1.0],  # 标签 3
        [0.0],  # 标签 4
    ])

    # ---- 训练 ----
    train_model(model, X, y, epochs=2000, lr=0.5, momentum=0.9)

    # ---- 测试 ----
    y_pred = predict(model, X)

    print()
    print("  训练结果：")
    print("  " + "-" * 45)
    print("    输入    →    预测值    |  真实值  |  判断")
    print("  " + "-" * 45)

    correct = 0
    for i in range(len(X)):
        pred = y_pred[i].item()
        true = y[i].item()
        is_correct = (pred > 0.5) == (true > 0.5)
        correct += int(is_correct)
        flag = "[OK]" if is_correct else "[NO]"
        print(f"    {X[i].tolist()} -> {pred:.4f}    |  {int(true)}      |  {flag}")

    print("  " + "-" * 45)
    print(f"  准确率: {correct}/{len(X)}")
    print()


def demo_parity():
    """
    Demo 2：3位奇偶校验

    判断三个二进制位中 1 的个数是奇数还是偶数。
    这比 XOR 更难，因为 8 种输入模式都需要被正确分类。

    论文中类似的"家族相似性"任务展示了隐藏层如何学习到有用的内部表示。
    """
    print("=" * 60)
    print("实验二：3位奇偶校验 —— 隐藏层如何学到特征表示")
    print("=" * 60)
    print()
    print("  网络结构：3个输入 → 6个隐藏神经元 → 1个输出")
    print()

    torch.manual_seed(42)
    model = BPNetwork([3, 6, 1])

    # 3位二进制所有组合（共 8 种）
    X = torch.tensor([
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 1.0],
        [1.0, 0.0, 0.0],
        [1.0, 0.0, 1.0],
        [1.0, 1.0, 0.0],
        [1.0, 1.0, 1.0],
    ])
    # 奇偶标签：1的个数为奇数 → 1
    y = torch.tensor([
        [0.0],  # 0个1 → 偶数 → 0
        [1.0],  # 1个1 → 奇数 → 1
        [1.0],  # 1个1 → 奇数 → 1
        [0.0],  # 2个1 → 偶数 → 0
        [1.0],  # 1个1 → 奇数 → 1
        [0.0],  # 2个1 → 偶数 → 0
        [0.0],  # 2个1 → 偶数 → 0
        [1.0],  # 3个1 → 奇数 → 1
    ])

    train_model(model, X, y, epochs=3000, lr=0.5, momentum=0.9)

    y_pred = predict(model, X)

    print()
    print("  训练结果：")
    print("  " + "-" * 50)
    print("     输入     →    预测值    |  真实值  |  判断")
    print("  " + "-" * 50)

    correct = 0
    for i in range(len(X)):
        pred = y_pred[i].item()
        true = y[i].item()
        is_correct = (pred > 0.5) == (true > 0.5)
        correct += int(is_correct)
        flag = "[OK]" if is_correct else "[NO]"
        bits = [int(v) for v in X[i].tolist()]
        print(f"    {bits} -> {pred:.4f}    |    {int(true)}     |  {flag}")

    print("  " + "-" * 50)
    print(f"  准确率: {correct}/{len(X)}")
    print()


def demo_compare():
    """
    Demo 3：看看隐藏层到底学到了什么？

    论文说："内部隐藏单元学会了表示任务领域的重要特征。"
    我们来看看这些隐藏单元的值到底长什么样。
    """
    print("=" * 60)
    print("实验三：窥探隐藏层 —— 内部表示到底长什么样？")
    print("=" * 60)
    print()
    print("  " * 4 + "网络结构展示")
    print("  " + "-" * 40)
    print("  " * 4 + "输入层 -> 隐藏层 -> 输出层")
    print("  " * 4 + " x1 -h1-> y")
    print("  " * 4 + " x2 -h2->")
    print("  " * 4 + "      h3")
    print()
    print("  训练后 h1 h2 h3 的值就是网络学到的内部表示")
    print()

    torch.manual_seed(42)
    # 网络结构：2 → 3 → 1
    # 我们选择 3 个隐藏神经元是因为数量少，方便全部打印出来观察
    model = BPNetwork([2, 3, 1])

    X = torch.tensor([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]])
    y = torch.tensor([[0.0], [1.0], [1.0], [0.0]])

    # ---- 训练前先看一眼隐藏层的值 ----
    with torch.no_grad():
        h_before = torch.sigmoid(model.linears[0](X))

    # ---- 训练 ----
    train_model(model, X, y, epochs=3000, lr=0.5, momentum=0.9)

    # ---- 训练后再看隐藏层的值 ----
    with torch.no_grad():
        h_after = torch.sigmoid(model.linears[0](X))
    y_pred = predict(model, X)

    print()
    print("  训练前 vs 训练后的隐藏层激活值：")
    print("  " + "-" * 55)

    for i in range(len(X)):
        inp = X[i].tolist()
        hb = [f"{v:.3f}" for v in h_before[i].tolist()]
        ha = [f"{v:.3f}" for v in h_after[i].tolist()]
        out = y_pred[i].item()
        print(f"    输入 {inp}  |  训练前 [{', '.join(hb)}] |  训练后 [{', '.join(ha)}]  | 输出 {out:.3f}")

    print()
    print("  观察上面的结果，你会发现：")
    print("  · 训练前：隐藏层的值很接近，对所有输入几乎一样")
    print("  · 训练后：隐藏层的值变得有区分度了")
    print("  · 这就是论文所说的 '学习到了有意义的内部表示'")
    print()


# ============================================================================
# 运行所有实验
# ============================================================================

if __name__ == "__main__":
    demo_xor()
    demo_parity()
    demo_compare()
