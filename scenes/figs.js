import { THREE, person, std, makeSun, palmFan, stool } from '../lib.js';
export const DUR = 1;
export async function build({ scene, camera }) {
  scene.background = new THREE.Color('#9a968c');
  scene.add(new THREE.HemisphereLight('#ffffff', '#555', 2));
  const sun = makeSun(scene, { intensity: 2.5, dir: [0.4, 0.8, 0.6], box: 5 }); sun.follow(new THREE.Vector3());
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), std({ color: '#8a8070' })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const list = [
    person({ pose: 'stand' }),
    person({ pose: 'squat', cig: true, sleeves: 'none', arm: 'mouth' }),
    person({ pose: 'squat', shirt: '#56606c', cig: true, bald: true, sleeves: 'short' }),
    person({ pose: 'sitLow', shirt: '#f0ede4', sleeves: 'none', arm: 'fan' }),
    person({ pose: 'sit', shirt: '#c43a2e', scale: 0.6 }),
    person({ pose: 'stand', shirt: '#c43a2e', pants: '#2e3f78', scale: 0.62 }),
  ];
  list.forEach((p, i) => { p.position.set(-2.5 + i * 1.0, 0, 0); p.rotation.y = 0.5; scene.add(p); });
  const st = stool(); st.position.set(-2.5 + 3, 0, -0.05); scene.add(st);
  const fan = palmFan(); fan.position.set(0, 0.3, 0.02); fan.rotation.y = Math.PI / 2; list[3].userData.handR.add(fan);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), std({ color: '#733' })); sb.position.set(-2.5 + 4, 0.26, 0); scene.add(sb);
  list[4].position.y = 0.0;
  return (t) => {
    const views = [[0.3, 1.4, 4.2, 0.3, 0.6, 0], [3.2, 1.0, 1.8, 0.3, 0.5, 0], [-2.5, 1.2, 2.8, 0.0, 0.5, 0]];
    const v = views[Math.round(t)] || views[0];
    camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]);
  };
}
