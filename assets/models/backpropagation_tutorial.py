"""
Learning Representations by Back-propagating Errors
David E. Rumelhart, Geoffrey E. Hinton, Ronald J. Williams
Nature, 1986
https://www.nature.com/articles/323533a0

本文件是面向初学者的教学实现，详细讲解反向传播算法的每一步。

关键概念 (Key Concepts):
------------------------
1. 多层感知机 (MLP): 由输入层、隐藏层、输出层组成的神经网络。
2. 前向传播 (Forward Propagation): 数据从输入层逐层传递到输出层。
3. 损失函数 (Loss Function): 衡量预测值与真实值之间的差距。
4. 链式法则 (Chain Rule): 反向传播的核心数学工具，用于计算复合函数的导数。
5. 反向传播 (Backpropagation): 利用链式法则从输出层向输入层逐层计算梯度。
6. 梯度下降 (Gradient Descent): 沿着梯度的反方向更新参数，以最小化损失函数。

为什么用 Sigmoid 激活函数?
--------------------------
论文发表于 1986 年，当时 Sigmoid 是标准的激活函数。
它将任意实数映射到 (0, 1) 区间，且处处可导，非常适合链式法则的应用。
"""

import math
import random


# ------------------------------------------------------------------
# 配置常量 —— 每个常量的含义和影响
# ------------------------------------------------------------------
INPUT_DIM   = 2      # 输入层神经元数量: XOR 问题有两个输入位 (0/1)
HIDDEN_DIM  = 4      # 隐藏层神经元数量: 4 个隐藏单元足够学习 XOR 的非线性边界
OUTPUT_DIM  = 1      # 输出层神经元数量: XOR 输出是一个二进制值 (0 或 1)
SEED        = 1986   # 随机种子: 保证每次运行结果可复现
LR          = 0.5    # 学习率 (eta): 控制参数更新的步长，太大可能震荡，太小收敛慢
EPOCHS      = 10000  # 训练轮数: 迭代次数，足够让网络收敛到很小的误差

# XOR 数据集 —— 经典的非线性可分问题
# 单层的感知机无法解决 XOR，但多层网络可以
X = [[0.0, 0.0],
     [0.0, 1.0],
     [1.0, 0.0],
     [1.0, 1.0]]
Y = [[0.0],
     [1.0],
     [1.0],
     [0.0]]


# ------------------------------------------------------------------
# 激活函数
# ------------------------------------------------------------------
def sigmoid(z):
    """
    Sigmoid 激活函数: σ(z) = 1 / (1 + exp(-z))
    将线性输出压缩到 (0, 1) 区间，适合二分类问题。
    """
    return 1.0 / (1.0 + math.exp(-z))


def sigmoid_derivative(a):
    """
    Sigmoid 的导数: σ'(z) = σ(z) * (1 - σ(z))
    注意这里传入的是已经经过 sigmoid 激活后的值 a，而不是原始 z。
    这个性质使得计算非常高效。
    """
    return a * (1.0 - a)


# ------------------------------------------------------------------
# 小型矩阵工具函数 (纯 Python 实现，无外部依赖)
# ------------------------------------------------------------------
def mat_zeros(rows, cols):
    """创建全零矩阵"""
    return [[0.0] * cols for _ in range(rows)]


def mat_add(A, B):
    """矩阵逐元素相加 (支持广播: B 可以是单行)"""
    rows, cols = len(A), len(A[0])
    if len(B) == 1:
        return [[A[i][j] + B[0][j] for j in range(cols)] for i in range(rows)]
    return [[A[i][j] + B[i][j] for j in range(cols)] for i in range(rows)]


def mat_sub(A, B):
    """矩阵逐元素相减 (支持广播: B 可以是单行)"""
    rows, cols = len(A), len(A[0])
    if len(B) == 1:
        return [[A[i][j] - B[0][j] for j in range(cols)] for i in range(rows)]
    return [[A[i][j] - B[i][j] for j in range(cols)] for i in range(rows)]


def mat_mul(A, B):
    """矩阵乘法: A @ B"""
    rows_a, cols_a = len(A), len(A[0])
    rows_b, cols_b = len(B), len(B[0])
    assert cols_a == rows_b, "矩阵维度不匹配，无法相乘"
    C = mat_zeros(rows_a, cols_b)
    for i in range(rows_a):
        for j in range(cols_b):
            s = 0.0
            for k in range(cols_a):
                s += A[i][k] * B[k][j]
            C[i][j] = s
    return C


def mat_transpose(A):
    """矩阵转置"""
    rows, cols = len(A), len(A[0])
    return [[A[i][j] for i in range(rows)] for j in range(cols)]


def mat_scalar_mul(A, s):
    """矩阵与标量相乘"""
    rows, cols = len(A), len(A[0])
    return [[A[i][j] * s for j in range(cols)] for i in range(rows)]


def mat_hadamard(A, B):
    """Hadamard 积: 矩阵逐元素相乘"""
    rows, cols = len(A), len(A[0])
    return [[A[i][j] * B[i][j] for j in range(cols)] for i in range(rows)]


def mat_sum_rows(A):
    """对每列求和，返回列向量"""
    rows, cols = len(A), len(A[0])
    return [[sum(A[i][j] for i in range(rows))] for j in range(cols)]


def mat_mean(A):
    """计算矩阵所有元素的平均值"""
    rows, cols = len(A), len(A[0])
    total = sum(A[i][j] for i in range(rows) for j in range(cols))
    return total / (rows * cols)


def mat_apply(A, func):
    """对矩阵每个元素应用函数"""
    rows, cols = len(A), len(A[0])
    return [[func(A[i][j]) for j in range(cols)] for i in range(rows)]


# ------------------------------------------------------------------
# 多层感知机 (MLP) —— 手动实现反向传播
# ------------------------------------------------------------------
class MLP:
    """
    多层感知机 (Multilayer Perceptron)

    网络结构:
        输入层 (2) -> 隐藏层 (4, sigmoid) -> 输出层 (1, sigmoid)

    前向传播流程:
        z1 = x · W1 + b1    # 隐藏层线性变换
        a1 = sigmoid(z1)    # 隐藏层激活
        z2 = a1 · W2 + b2   # 输出层线性变换
        a2 = sigmoid(z2)    # 输出层激活 (最终预测)

    反向传播流程 (链式法则):
        从损失函数 L 开始，逐层向前计算梯度:
        ∂L/∂W2 = (∂L/∂a2) * (∂a2/∂z2) * (∂z2/∂W2)
        ∂L/∂W1 = (∂L/∂a2) * (∂a2/∂z2) * (∂z2/∂a1) * (∂a1/∂z1) * (∂z1/∂W1)
    """

    def __init__(self, input_dim, hidden_dim, output_dim, seed=SEED):
        """
        初始化网络参数。

        权重初始化:
            使用小的随机值初始化权重，打破对称性。
            如果全部初始化为 0，所有神经元将学习相同的特征。
        偏置初始化:
            偏置通常初始化为 0。
        """
        random.seed(seed)

        # 第一层参数: 输入 -> 隐藏层
        # W1 形状: (input_dim, hidden_dim) = (2, 4)
        # 每个输入特征连接到每个隐藏神经元
        self.W1 = [[random.gauss(0.0, 1.0) for _ in range(hidden_dim)] for _ in range(input_dim)]
        self.b1 = [[0.0] * hidden_dim]

        # 第二层参数: 隐藏层 -> 输出层
        # W2 形状: (hidden_dim, output_dim) = (4, 1)
        # 每个隐藏神经元连接到输出神经元
        self.W2 = [[random.gauss(0.0, 1.0) for _ in range(output_dim)] for _ in range(hidden_dim)]
        self.b2 = [[0.0] * output_dim]

    def forward(self, x):
        """
        前向传播 (Forward Propagation)

        输入 x 形状: (batch_size, input_dim) = (4, 2)

        步骤:
            1. 计算隐藏层线性输出 z1 = x·W1 + b1
               形状变化: (4, 2) @ (2, 4) + (1, 4) -> (4, 4)
            2. 应用 Sigmoid 激活得到 a1
            3. 计算输出层线性输出 z2 = a1·W2 + b2
               形状变化: (4, 4) @ (4, 1) + (1, 1) -> (4, 1)
            4. 应用 Sigmoid 激活得到最终预测 a2
        """
        # 隐藏层
        self.z1 = mat_add(mat_mul(x, self.W1), self.b1)   # 线性变换
        self.a1 = mat_apply(self.z1, sigmoid)             # 激活: 引入非线性

        # 输出层
        self.z2 = mat_add(mat_mul(self.a1, self.W2), self.b2)   # 线性变换
        self.a2 = mat_apply(self.z2, sigmoid)                   # 激活: 输出概率-like值

        return self.a2

    def backward(self, x, y):
        """
        反向传播 (Backpropagation) —— 链式法则的核心应用

        损失函数: L = 0.5 * (a2 - y)^2  (均方误差 MSE)

        输出层梯度推导:
            ∂L/∂a2 = a2 - y                           # 损失对输出的导数
            ∂a2/∂z2 = a2 * (1 - a2)                   # Sigmoid 导数
            dz2 = ∂L/∂z2 = (a2 - y) * σ'(z2)         # 输出层误差信号

            ∂z2/∂W2 = a1.T                            # z2 = a1·W2 + b2
            dW2 = a1.T @ dz2 / m                      # 损失对 W2 的梯度

        隐藏层梯度推导:
            ∂z2/∂a1 = W2.T                            # z2 对 a1 的导数
            ∂a1/∂z1 = a1 * (1 - a1)                   # Sigmoid 导数
            dz1 = ∂L/∂z1 = (dz2 @ W2.T) * σ'(z1)     # 误差反向传播到隐藏层

            ∂z1/∂W1 = x.T                             # z1 = x·W1 + b1
            dW1 = x.T @ dz1 / m                       # 损失对 W1 的梯度

        为什么叫"反向传播"?
            因为误差信号从输出层开始，逐层向输入层传播，
            每一层利用上一层的误差计算本层的梯度。
        """
        m = len(x)   # batch size

        # ------------------- 输出层梯度 -------------------
        # dz2: 输出层的误差信号，形状 (4, 1)
        dz2 = mat_hadamard(mat_sub(self.a2, y), mat_apply(self.a2, sigmoid_derivative))

        # dW2: W2 的梯度，形状 (4, 1)
        # 每个隐藏层激活值 a1 对 W2 中对应权重的贡献
        dW2 = mat_scalar_mul(mat_mul(mat_transpose(self.a1), dz2), 1.0 / m)

        # db2: b2 的梯度，形状 (1, 1)
        db2 = mat_transpose(mat_sum_rows(dz2))
        db2 = mat_scalar_mul(db2, 1.0 / m)

        # ------------------- 隐藏层梯度 -------------------
        # dz1: 隐藏层的误差信号，形状 (4, 4)
        # 将输出层误差 dz2 通过 W2 反向传播，再乘以 sigmoid 导数
        dz1 = mat_hadamard(mat_mul(dz2, mat_transpose(self.W2)), mat_apply(self.a1, sigmoid_derivative))

        # dW1: W1 的梯度，形状 (2, 4)
        dW1 = mat_scalar_mul(mat_mul(mat_transpose(x), dz1), 1.0 / m)

        # db1: b1 的梯度，形状 (1, 4)
        db1 = mat_transpose(mat_sum_rows(dz1))
        db1 = mat_scalar_mul(db1, 1.0 / m)

        return dW1, db1, dW2, db2

    def update(self, dW1, db1, dW2, db2, lr=LR):
        """
        参数更新 —— 随机梯度下降 (SGD)

        更新规则: W = W - lr * dW

        学习率 lr 的作用:
            - 控制每次更新的步长
            - 太大: 可能在最优解附近震荡，甚至发散
            - 太小: 收敛速度极慢
        """
        self.W1 = mat_sub(self.W1, mat_scalar_mul(dW1, lr))
        self.b1 = mat_sub(self.b1, mat_scalar_mul(db1, lr))
        self.W2 = mat_sub(self.W2, mat_scalar_mul(dW2, lr))
        self.b2 = mat_sub(self.b2, mat_scalar_mul(db2, lr))

    def train(self, x, y, epochs=EPOCHS, lr=LR):
        """
        训练循环

        每轮迭代:
            1. 前向传播: 计算当前预测值
            2. 计算损失: 评估预测与真实的差距
            3. 反向传播: 计算所有参数的梯度
            4. 参数更新: 沿梯度反方向调整参数

        随着训练进行，损失应该逐渐减小，预测逐渐准确。
        """
        for epoch in range(epochs):
            # 前向传播
            out = self.forward(x)

            # 计算损失 (MSE)
            diff = mat_sub(out, y)
            sq = mat_hadamard(diff, diff)
            loss = mat_mean(sq) * 0.5

            # 反向传播: 计算梯度
            dW1, db1, dW2, db2 = self.backward(x, y)

            # 更新参数
            self.update(dW1, db1, dW2, db2, lr)

            # 每 1000 轮打印一次损失
            if epoch % 1000 == 0:
                print(f"Epoch {epoch:5d} | Loss: {loss:.6f}")

        return loss

    def predict(self, x):
        """预测: 直接返回前向传播结果"""
        return self.forward(x)


# ------------------------------------------------------------------
# 主程序 —— 教育演示
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("反向传播算法教学演示 (Rumelhart et al., 1986)")
    print("=" * 60)

    # 创建模型
    model = MLP(INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM)

    # 打印网络信息
    print(f"\n网络结构: {INPUT_DIM}-{HIDDEN_DIM}-{OUTPUT_DIM}")
    print(f"  - 输入层: {INPUT_DIM} 个神经元 (XOR 的两个输入位)")
    print(f"  - 隐藏层: {HIDDEN_DIM} 个神经元 (带 Sigmoid 激活)")
    print(f"  - 输出层: {OUTPUT_DIM} 个神经元 (带 Sigmoid 激活)")

    total_params = INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM + HIDDEN_DIM * OUTPUT_DIM + OUTPUT_DIM
    print(f"\n总参数量: {total_params}")
    print(f"  - W1: {INPUT_DIM}×{HIDDEN_DIM} = {INPUT_DIM*HIDDEN_DIM}")
    print(f"  - b1: {HIDDEN_DIM}")
    print(f"  - W2: {HIDDEN_DIM}×{OUTPUT_DIM} = {HIDDEN_DIM*OUTPUT_DIM}")
    print(f"  - b2: {OUTPUT_DIM}")

    print("\n--- 开始训练 ---")
    print("注意: XOR 是线性不可分的，需要隐藏层才能解决。")
    final_loss = model.train(X, Y, epochs=EPOCHS, lr=LR)

    print("\n--- 评估结果 ---")
    preds = model.predict(X)
    print("\nXOR 真值表:")
    print("-" * 45)
    for xi, yi, pi in zip(X, Y, preds):
        print(f"  Input: {xi} | Target: {int(yi[0])} | Prediction: {pi[0]:.6f}")
    print("-" * 45)

    print(f"\n最终 MSE 损失: {final_loss:.6f}")
    rounded = [round(p[0]) for p in preds]
    print(f"四舍五入后的预测: {rounded}")

    if all(round(p[0]) == int(y[0]) for p, y in zip(preds, Y)):
        print("\n成功! 网络已学会 XOR 函数!")
    else:
        print("\n尚未完全收敛，可以尝试增加训练轮数或调整学习率。")

    # ------------------------------------------------------------------
    # 练习建议 (供读者动手修改)
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("练习建议:")
    print("=" * 60)
    print("1. 尝试将 HIDDEN_DIM 改为 2 或 8，观察收敛速度和效果变化。")
    print("2. 尝试修改 LR (学习率) 为 0.1 或 1.0，观察训练稳定性。")
    print("3. 尝试使用 ReLU 激活函数替代 Sigmoid，看看是否需要调整学习率。")
    print("4. 尝试添加第二个隐藏层，构建更深的网络。")
    print("5. 尝试解决其他逻辑问题，如半加器 (Half Adder)。")
