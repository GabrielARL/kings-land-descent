# Trace of CAJODE's known-channel kernel (bit_update! and Parity.consensus_update!, the loop of decode_llr in
# joint_cbz_temporal_receiver.jl) on the tiny codes of the advanced tutorial "The Jade Keep", printed circuit by
# circuit.  test_keep.js carries these numbers and checks keep.js against them. The CAJODE modules import
# JadeJcade, so use the JadeJcade Julia environment. Set CAJODE_ROOT explicitly, or leave it unset when CAJODE
# is a sibling of an ancestor directory:
#     CAJODE_ROOT=/path/to/CAJODE julia --project=/path/to/JadeJcade --startup-file=no source/simulator/keep_trace.jl
function find_cajode_root()
    haskey(ENV, "CAJODE_ROOT") && return normpath(ENV["CAJODE_ROOT"])
    base = normpath(@__DIR__)
    for _ in 1:8
        candidate = joinpath(base, "CAJODE")
        isfile(joinpath(candidate, "src", "CAJODE.jl")) && return candidate
        parent = dirname(base)
        parent == base && break
        base = parent
    end
    return normpath(joinpath(@__DIR__, "..", "..", "..", "..", "..", "CAJODE"))
end

const CAJODE_ROOT = find_cajode_root()
const CAJODE_ENTRY = joinpath(CAJODE_ROOT, "src", "CAJODE.jl")
isfile(CAJODE_ENTRY) || error("CAJODE source not found at $(CAJODE_ENTRY). Set CAJODE_ROOT to the CAJODE checkout.")
include(CAJODE_ENTRY)
using .CAJODE
const RX = CAJODE.TemporalReceiver
const JC = CAJODE.CoordinateADMM
const Parity = CAJODE.ParityADMM

function trace(checks, llr, sent; rho=3.0, beta=0.8, iterations=12,
               expected_first_accepted=nothing)
    n = length(llr)
    plan = JC.prepare(checks, n)
    fixed = falses(n); fixed_bits = falses(n)
    accept = w -> all(w .== sent)
    res = RX.decode_llr(plan, llr; rho, beta, iterations=200, accept_word=accept)
    res.accepted && all(res.word .== sent) || error(
        "decode_llr did not return the oracle-accepted sent word")
    expected_first_accepted === nothing ||
        res.first_accepted_iteration == expected_first_accepted || error(
            "first accepted circuit changed: expected $(expected_first_accepted), got $(res.first_accepted_iteration)")
    println("CODE checks=", checks, " llr=", llr, " sent=", Int.(sent))
    println("decode_llr word=", join(Int.(res.word)), " accepted=", res.accepted,
            " first_valid=", res.first_valid_iteration, " first_accepted=", res.first_accepted_iteration,
            " iterations_run=", res.iterations_run, " relaxed=", repr(res.relaxed))
    # the same loop, step by step, without the early stop
    g = Float64.(llr); h = zeros(n)
    b = Float64.(g .< 0); x = 1.0 .- 2.0 .* b
    parity = Parity.initialize(plan.parity, x, fixed, fixed_bits)
    println("iter 0 b=", repr(b), " z=", repr(copy(parity.z)), " u=", repr(copy(parity.dual)),
            " hard=", join(Int.(b .>= 0.5)), " syndrome=", JC.syndrome_weight(plan, BitVector(b .>= 0.5)))
    b0 = similar(b)
    for it in 1:iterations
        copyto!(b0, b)
        RX.bit_update!(b, b0, g, h, plan, parity, fixed, fixed_bits; rho, beta)
        x .= 1.0 .- 2.0 .* b
        c = Parity.consensus_update!(plan.parity, parity, x, fixed, fixed_bits; rho)
        hard = BitVector(b .>= 0.5)
        println("iter ", it, " b=", repr(b), " z=", repr(copy(parity.z)), " u=", repr(copy(parity.dual)),
                " hard=", join(Int.(hard)), " syndrome=", JC.syndrome_weight(plan, hard),
                " primal_rms=", repr(c.primal_rms), " dual_rms=", repr(c.dual_rms))
    end
    println("plan.variable_edges=", plan.variable_edges, " parity.variables=", plan.parity.variables, " offsets=", plan.parity.offsets)
    println()
end

trace([[1, 2]], [1.0, -0.6], [false, false]; expected_first_accepted=3)
trace([[1, 2]], [16/3, -10/3], [false, false]; expected_first_accepted=4)
trace([[1, 2], [2, 3]], [1.2, -0.5, 0.9], [false, false, false];
      expected_first_accepted=2)
