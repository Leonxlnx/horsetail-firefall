"""Shape the score around the cut and mix a deterministic stereo water bed."""
import os
os.environ["OPENBLAS_NUM_THREADS"]="1"
os.environ["OMP_NUM_THREADS"]="1"
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io.wavfile import write

root=Path(__file__).resolve().parents[1]
work=root/".work"
rate=48000
def excerpt(start,length):
    raw=subprocess.check_output(["ffmpeg","-v","error","-threads","1","-ss",str(start),"-i",str(work/"passage-of-time.mp3"),
        "-t",str(length),"-ar",str(rate),"-ac","2","-f","f32le","pipe:1"])
    return np.frombuffer(raw,dtype="<f4").reshape(-1,2)

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

t=np.arange(40*rate)/rate
mix=np.zeros((len(t),2),dtype="float32")
cross=29.75
overlap=1.25
first=excerpt(178.95-cross,cross+overlap/2)
offset=round((cross-overlap/2)*rate)
last=excerpt(242.15-overlap/2,40-offset/rate)
fade=smooth(cross-overlap/2,cross+overlap/2,t)
mix[:len(first)]+=first*np.cos(fade[:len(first),None]*np.pi/2)
mix[offset:]+=last[:len(t)-offset]*np.sin(fade[offset:,None]*np.pi/2)
mix*=((.26+.74*smooth(0,2.7,t))*(1-smooth(37.75,40,t))*.88)[:,None]

# A broad point-source roar comes forward under the detail shots while the
# distant wind remains decorrelated in stereo across the valley.
rng=np.random.default_rng(1907)
def noise(lo,hi):
    w=rng.normal(0,1,len(t)).astype("float32")
    v=sosfilt(butter(3,[lo,hi],btype="bandpass",fs=rate,output="sos"),w)
    return v/(np.std(v)+1e-9)

near=.26+.60*smooth(10.8,14.0,t)+.42*smooth(21.6,23.9,t)-.98*smooth(27.3,29.0,t)
shared=noise(100,1150)
knots=np.arange(-1,42,.28)
breath=np.interp(t,knots,rng.uniform(.78,1.16,len(knots)))
bed=(smooth(0,1.0,t)*(1-smooth(38.0,40,t)))
for side in range(2):
    distant=noise(65,460)*.0045+noise(420,2100)*.0019
    water=shared*.008+noise(210,3200)*.008+noise(1050,6200)*.0038
    mix[:,side]+=(distant+water*near*(.91+side*.11))*bed*breath
peak=np.max(np.abs(mix))
mix*=min(1,.90/peak)
write(work/"mix.wav",rate,np.int16(np.clip(mix,-1,1)*32767))
subprocess.run(["ffmpeg","-hide_banner","-v","error","-y","-i",str(work/"mix.wav"),"-c:a","aac","-b:a","256k",
    "-metadata","title=Firefall — original film mix","-metadata","artist=Passage Of Time by Scott Buckley (edited excerpt)",
    "-metadata","copyright=Music licensed under CC BY 4.0. https://www.scottbuckley.com.au/library/passage-of-time/",
    "-movflags","+faststart",str(root/"public/media/firefall-sound.m4a")],check=True)
