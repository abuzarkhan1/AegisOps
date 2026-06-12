import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "../../shared/lib/cn";

type Uniforms = {
  [key: string]: {
    value: number[] | number[][] | number;
    type: string;
  };
};

interface ShaderProps {
  source: string;
  uniforms: Uniforms;
  maxFps?: number;
}

type SignInMode = "login" | "register";

interface SignInPageProps {
  className?: string;
  mode?: SignInMode;
  loading?: boolean;
  status?: string;
  onModeChange?: (mode: SignInMode) => void;
  onSubmit?: (payload: { mode: SignInMode; email: string; password: string; name?: string; organizationName?: string }) => Promise<void>;
  onSuccessContinue?: () => void;
}

export const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[255, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={cn("relative h-full w-full", containerClassName)}>
      <div className="h-full w-full">
        <DotMatrix
          colors={colors}
          dotSize={dotSize ?? 3}
          opacities={opacities}
          shader={`
            ${reverse ? "u_reverse_active" : "false"}_;
            animation_speed_factor_${animationSpeed.toFixed(1)}_;
          `}
          center={["x", "y"]}
        />
      </div>
      {showGradient ? <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" /> : null}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"]
}) => {
  const uniforms = useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length === 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]),
        type: "uniform3fv"
      },
      u_opacities: {
        value: opacities,
        type: "uniform1fv"
      },
      u_total_size: {
        value: totalSize,
        type: "uniform1f"
      },
      u_dot_size: {
        value: dotSize,
        type: "uniform1f"
      },
      u_reverse: {
        value: shader.includes("u_reverse_active") ? 1 : 0,
        type: "uniform1i"
      }
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`
        precision mediump float;
        in vec2 fragCoord;

        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;

        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) {
            return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
        }

        void main() {
            vec2 st = fragCoord.xy;
            ${center.includes("x") ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));" : ""}
            ${center.includes("y") ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));" : ""}

            float opacity = step(0.0, st.x);
            opacity *= step(0.0, st.y);

            vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

            float frequency = 5.0;
            float show_offset = random(st2);
            float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
            opacity *= u_opacities[int(rand * 10.0)];
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
            opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

            vec3 color = u_colors[int(show_offset * 6.0)];

            float animation_speed_factor = 0.5;
            vec2 center_grid = u_resolution / 2.0 / u_total_size;
            float dist_from_center = distance(center_grid, st2);
            float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
            float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
            float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

            float current_timing_offset;
            if (u_reverse == 1) {
                current_timing_offset = timing_offset_outro;
                opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            } else {
                current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
            }

            fragColor = vec4(color, opacity);
            fragColor.rgb *= fragColor.a;
        }`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

const ShaderMaterial = ({ source, uniforms, maxFps = 60 }: { source: string; maxFps?: number; uniforms: Uniforms }) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  const lastFrameTime = useRef(0);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();
    if (timestamp - lastFrameTime.current < 1 / maxFps) return;
    lastFrameTime.current = timestamp;

    const material = ref.current.material as THREE.ShaderMaterial;
    material.uniforms.u_time.value = timestamp;
  });

  const preparedUniforms = useMemo(() => {
    const nextUniforms: Record<string, { value: unknown; type?: string }> = {};

    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];

      switch (uniform.type) {
        case "uniform1f":
        case "uniform1i":
        case "uniform1fv":
          nextUniforms[uniformName] = { value: uniform.value };
          break;
        case "uniform3f":
          nextUniforms[uniformName] = { value: new THREE.Vector3().fromArray(uniform.value as number[]) };
          break;
        case "uniform3fv":
          nextUniforms[uniformName] = {
            value: (uniform.value as number[][]).map((value) => new THREE.Vector3().fromArray(value))
          };
          break;
        case "uniform2f":
          nextUniforms[uniformName] = { value: new THREE.Vector2().fromArray(uniform.value as number[]) };
          break;
        default:
          break;
      }
    }

    nextUniforms.u_time = { value: 0 };
    nextUniforms.u_resolution = {
      value: new THREE.Vector2(size.width * 2, size.height * 2)
    };
    return nextUniforms;
  }, [size.height, size.width, uniforms]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          precision mediump float;
          in vec2 coordinates;
          uniform vec2 u_resolution;
          out vec2 fragCoord;
          void main(){
            float x = position.x;
            float y = position.y;
            gl_Position = vec4(x, y, 0.0, 1.0);
            fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }
        `,
        fragmentShader: source,
        uniforms: preparedUniforms,
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor
      }),
    [preparedUniforms, source]
  );

  return (
    <mesh ref={ref}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => {
  return (
    <Canvas className="absolute inset-0 h-full w-full" dpr={[1, 1.75]}>
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
};

export const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const label = typeof children === "string" ? children : undefined;

  return (
    <Link
      to={href}
      aria-label={label}
      className="group relative grid h-8 place-items-center overflow-hidden rounded-full px-3 text-sm font-medium leading-none"
    >
      <div className="flex h-16 flex-col transition-transform duration-300 ease-out group-hover:-translate-y-8">
        <span aria-hidden="true" className="grid h-8 place-items-center whitespace-nowrap text-gray-300">
          {children}
        </span>
        <span aria-hidden="true" className="grid h-8 place-items-center whitespace-nowrap text-white">
          {children}
        </span>
      </div>
    </Link>
  );
};

export function MiniNavbar({
  onModeChange,
  activeMode,
  links,
  loginHref = "/login",
  signupHref = "/register",
  showAuthActions = true
}: {
  onModeChange?: (mode: SignInMode) => void;
  activeMode?: SignInMode;
  links?: Array<{ label: string; href: string }>;
  loginHref?: string;
  signupHref?: string;
  showAuthActions?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState("rounded-full");
  const shapeTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      window.clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass("rounded-2xl");
    } else {
      shapeTimeoutRef.current = window.setTimeout(() => setHeaderShapeClass("rounded-full"), 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        window.clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const navLinksData = links ?? [
    { label: "Product", href: "/product" },
    { label: "Solutions", href: "/solutions" },
    { label: "Docs", href: "/docs" }
  ];

  const loginButtonElement = (
    <Link
      to={onModeChange ? "#" : loginHref}
      onClick={(event) => {
        if (!onModeChange) return;
        event.preventDefault();
        onModeChange("login");
      }}
      className={cn(
        "inline-flex justify-center",
        "w-full rounded-full border border-[#333] bg-[rgba(31,31,31,0.62)] px-4 py-2 text-xs text-gray-300 transition-colors duration-200 hover:border-white/50 hover:text-white sm:w-auto sm:px-3 sm:text-sm",
        activeMode === "login" && "border-white/40 text-white"
      )}
    >
      LogIn
    </Link>
  );

  const signupButtonElement = (
    <div className="group relative w-full sm:w-auto">
      <div className="pointer-events-none absolute inset-0 -m-2 hidden rounded-full bg-gray-100 opacity-40 blur-lg transition-all duration-300 ease-out group-hover:-m-3 group-hover:opacity-60 group-hover:blur-xl sm:block" />
      <Link
        to={onModeChange ? "#" : signupHref}
        onClick={(event) => {
          if (!onModeChange) return;
          event.preventDefault();
          onModeChange("register");
        }}
        className={cn(
          "inline-flex justify-center",
          "relative z-10 w-full rounded-full bg-gradient-to-br from-gray-100 to-gray-300 px-4 py-2 text-xs font-semibold text-black transition-all duration-200 hover:from-gray-200 hover:to-gray-400 sm:w-auto sm:px-3 sm:text-sm",
          activeMode === "register" && "ring-2 ring-white/40"
        )}
      >
        Signup
      </Link>
    </div>
  );

  return (
    <header
      className={cn(
        "fixed left-1/2 top-6 z-20 flex w-[calc(100%-2rem)] -translate-x-1/2 transform flex-col items-center border border-[#333] bg-[#1f1f1f70] px-3 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[border-radius] duration-0 ease-in-out sm:w-auto sm:px-4",
        headerShapeClass
      )}
    >
      <div className="flex w-full items-center justify-between gap-x-3 sm:gap-x-4">
        <Link to="/" aria-label="AegisOps home" className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-gray-200 opacity-80" />
          <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 transform rounded-full bg-gray-200 opacity-80" />
          <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 transform rounded-full bg-gray-200 opacity-80" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-gray-200 opacity-80" />
        </Link>

        <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Public navigation">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.href} href={link.href}>
              {link.label}
            </AnimatedNavLink>
          ))}
        </nav>

        {showAuthActions ? (
          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            {loginButtonElement}
            {signupButtonElement}
          </div>
        ) : null}

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-gray-300 focus:outline-none sm:hidden"
          onClick={() => setIsOpen((value) => !value)}
          aria-label={isOpen ? "Close Menu" : "Open Menu"}
        >
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={cn(
          "flex w-full flex-col items-center overflow-hidden transition-all duration-300 ease-in-out sm:hidden",
          isOpen ? "max-h-[1000px] pt-4 opacity-100" : "max-h-0 pt-0 opacity-0 pointer-events-none"
        )}
      >
        <nav className="flex w-full flex-col items-center space-y-4 text-base" aria-label="Mobile public navigation">
          {navLinksData.map((link) => (
            <Link key={link.href} to={link.href} className="w-full text-center text-gray-300 transition-colors hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        {showAuthActions ? (
          <div className="mt-4 flex w-full flex-col items-center space-y-4">
            {loginButtonElement}
            {signupButtonElement}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function AegisAnimatedBackdrop({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <CanvasRevealEffect
        animationSpeed={reverse ? 4 : 3}
        containerClassName="bg-black"
        colors={[
          [255, 255, 255],
          [255, 255, 255]
        ]}
        dotSize={6}
        reverse={reverse}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
      <div className="absolute left-0 right-0 top-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
    </div>
  );
}

export const SignInPage = ({
  className,
  mode = "login",
  loading = false,
  status,
  onModeChange,
  onSubmit,
  onSuccessContinue
}: SignInPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [step, setStep] = useState<"email" | "success">("email");
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);

  useEffect(() => {
    setStep("email");
    setReverseCanvasVisible(false);
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || loading) return;
    try {
      await onSubmit?.({ mode, email, password, name, organizationName });
      setReverseCanvasVisible(true);
      window.setTimeout(() => setStep("success"), 700);
    } catch {
      setReverseCanvasVisible(false);
      setStep("email");
    }
  };

  const title = mode === "register" ? "Create your command center" : "Welcome Developer";
  const subtitle = mode === "register" ? "Start monitoring with AegisOps" : "Sign in to AegisOps";

  return (
    <div className={cn("relative flex min-h-screen w-full flex-col overflow-hidden bg-black", className)}>
      <AegisAnimatedBackdrop />
      {reverseCanvasVisible ? (
        <div className="absolute inset-0 z-0">
          <AegisAnimatedBackdrop reverse />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col">
        <MiniNavbar onModeChange={onModeChange} activeMode={mode} />

        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">
            <div className="mt-[72px] w-full max-w-sm">
              <AnimatePresence mode="wait">
                {step === "email" ? (
                  <motion.div
                    key={`${mode}-email-step`}
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">{title}</h1>
                      <p className="text-[1.8rem] font-light text-white/70">{subtitle}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                      {mode === "register" ? (
                        <>
                          <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-white backdrop-blur-[1px] placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Workspace name"
                            value={organizationName}
                            onChange={(event) => setOrganizationName(event.target.value)}
                            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-white backdrop-blur-[1px] placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                          />
                        </>
                      ) : null}
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="info@gmail.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-white backdrop-blur-[1px] placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-white backdrop-blur-[1px] placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                          required
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                        />
                        <button
                          type="submit"
                          disabled={loading}
                          className="group absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-60"
                        >
                          <span className="relative block h-full w-full overflow-hidden">
                            <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                            </span>
                            <span className="absolute inset-0 flex -translate-x-full items-center justify-center transition-transform duration-300 group-hover:translate-x-0">
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                            </span>
                          </span>
                        </button>
                      </div>
                    </form>

                    <button
                      type="button"
                      onClick={() => onModeChange?.(mode === "login" ? "register" : "login")}
                      className="text-sm text-white/50 transition-colors hover:text-white/70"
                    >
                      {mode === "login" ? "Need an account? Signup" : "Already have an account? LogIn"}
                    </button>

                    {status ? (
                      <p className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/55">{status}</p>
                    ) : null}

                    <p className="pt-10 text-xs text-white/40">
                      By signing up, you agree to the{" "}
                      <Link to="/docs" className="underline transition-colors hover:text-white/60">
                        Product Terms
                      </Link>
                      ,{" "}
                      <Link to="/docs" className="underline transition-colors hover:text-white/60">
                        Policies
                      </Link>
                      , and{" "}
                      <Link to="/docs" className="underline transition-colors hover:text-white/60">
                        Privacy Notice
                      </Link>
                      .
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-step"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">You're in!</h1>
                      <p className="text-[1.25rem] font-light text-white/50">Welcome to AegisOps</p>
                    </div>

                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="py-10"
                    >
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-white to-white/70">
                        <Check className="h-8 w-8 text-black" />
                      </div>
                    </motion.div>

                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      onClick={onSuccessContinue}
                      className="w-full rounded-full bg-white py-3 font-medium text-black transition-colors hover:bg-white/90"
                    >
                      Continue to Dashboard
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
