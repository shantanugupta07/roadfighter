# 🏎️ Road Fighter: Retro Coin-Op Arcade Game

A fast-paced, rapid-scrolling 2D retro arcade racing game built with React, TypeScript, and HTML5 Canvas. Weave through chaotic traffic, manage your gear ratios, drift through oil slicks, and grab fuel canisters to reach the finish line before your energy runs out!

---

## 🎮 How to Play

### Mission Objective
Your main goal is to reach the finish line (**F**) of the roadway before your **Fuel Fluid (Energy)** level drops to 0%. 
- Crash into obstacles or side walls to trigger explosions, which cost a heavy fuel penalty and reset your speed.
- Colliding with other cars will push you into a lateral skid.
- Maintain top speeds by managing your gear box correctly.

### Keyboard Controls (Desktop)
*   **Accelerate (Gas):** `▲` or `W`
*   **Brake:** `▼` or `S`
*   **Steer Left / Right:** `◀` / `▶` or `A` / `D`
*   **Shift Gear (LOW ⇆ HIGH):** `Spacebar` or `G`
*   **Toggle Sound:** Mute icon in the header

### Touch Controls (Mobile)
When opened on a mobile device or running as a native Android wrapper app, a responsive controller overlay is automatically displayed:
*   **◀ / ▶ Buttons:** Steer left or right.
*   **ACCEL / BRAKE Pads:** Adjust your speed.
*   **SHIFT Button:** Toggles your transmission gear instantly.
*   **Heads-Up Display (HUD):** Compact dashboard showing your score, fuel percentage, velocity, gear, and current roadway stage.

---

## ⚙️ Advanced Game Mechanics

1.  **The Gearbox Strategy:** 
    *   **LOW Gear:** High acceleration but capped at a top speed of **196 km/h**. Ideal for starting from a crash or slow corner.
    *   **HIGH Gear:** Low acceleration/torque but unlocks extreme speeds up to **400 km/h**. 
    *   *Pro-Tip:* Accelerate in LOW gear until you reach ~150 km/h, then shift into HIGH gear to reach maximum velocity.
2.  **Survival Skid Recovery:**
    *   Bumping into standard cars or sliding over green **oil slicks** will cause your car to slip out of control.
    *   **Counter-steer immediately** in the opposite direction of the skid to regain traction. 
    *   *Warning:* If you hit the side walls while skidding, your car will explode!
3.  **Fuel Replenishment Cars (F):**
    *   Keep an eye out for flashing rainbow/golden cars marked with an **F**.
    *   Ram directly into them to absorb their fuel cores, gaining **+25 Fuel Units** and a score bonus.

---

## 🛠️ Tech Stack & Architecture

*   **Framework:** [React 19](https://react.dev/) + [Vite](https://vite.dev/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Graphics:** High-performance rendering loop using HTML5 `<canvas>` Context 2D.
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Responsive layouts optimized for desktop cabinet views and mobile screens).
*   **Native App Wrapper:** [Ionic Capacitor](https://capacitorjs.com/) (Packages the web bundle into native mobile app modules).
*   **Audio Engine:** Synthesized arcade motor sound frequencies and sound effects.

---

## 🚀 Running Locally

### Prerequisites
*   Node.js (v18 or higher recommended)

### Setup
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Run development server:**
    ```bash
    npm run dev
    ```
3.  Open `http://localhost:3000` in your web browser.

---

## 📱 Building Mobile Applications

This project is pre-configured with **Capacitor** to build for mobile platforms.

### Android (GitHub Actions - Free Cloud Build)
This repository includes a GitHub Actions CI/CD workflow that compiles the `.apk` file automatically on push.
1.  Push your changes to your remote GitHub repository (`git push origin main`).
2.  Go to the **Actions** tab on your GitHub repository.
3.  Wait for the **Build Android APK** workflow to run successfully (approx. 3 mins).
4.  Download the zipped `road-fighter-debug-apk` from the **Artifacts** section at the bottom of the run page.
5.  Extract the ZIP and install `app-debug.apk` directly on any Android device!

### Local Android Setup (Requires Android Studio)
To compile or test locally:
1.  Run the production sync script:
    ```bash
    npm run android:build
    ```
2.  Open the project in Android Studio:
    ```bash
    npx cap open android
    ```
3.  Run the app on your emulator or connected USB device.

### iOS Setup (Requires Xcode on macOS)
1.  Install iOS dependencies:
    ```bash
    npm install @capacitor/ios
    npx cap add ios
    ```
2.  Compile and sync assets:
    ```bash
    npm run build
    npx cap sync ios
    ```
3.  Open the workspace in Xcode:
    ```bash
    npx cap open ios
    ```
4.  Select a simulator or sign with your Apple developer account to deploy to a physical iPhone.
